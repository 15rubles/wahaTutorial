package app.muster.gamedata.build;

import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.Source;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Sources disagree on faction granularity: one may file a chapter unit under the chapter, another
 * under its parent faction. When the same datasheet or detachment name appears under factions of
 * one lineage, every source adopts the key of the most specific faction, and all references follow.
 */
final class KeyAligner {

    private KeyAligner() {}

    record Result(Map<Source, SourceSet> sources, List<ImportReport.Issue> issues) {}

    static Result align(Map<Source, SourceSet> sources) {
        Map<String, String> parent = new HashMap<>();
        for (SourceSet set : sources.values()) {
            for (SourceSet.Item i : set.items()) {
                if (i.type() == EntityType.FACTION && i.data().hasNonNull("parentKey")) {
                    parent.putIfAbsent(i.key(), i.data().get("parentKey").asText());
                }
            }
        }
        Map<String, String> remap = new LinkedHashMap<>();
        Map<String, String> factionOf = new HashMap<>();
        List<ImportReport.Issue> issues = new ArrayList<>();
        for (EntityType type : List.of(EntityType.DATASHEET, EntityType.DETACHMENT)) {
            Map<String, Set<String>> byName = new LinkedHashMap<>();
            for (SourceSet set : sources.values()) {
                for (SourceSet.Item i : set.items()) {
                    if (i.type() != type) continue;
                    String faction = i.data().path("faction").asText("");
                    factionOf.put(i.key(), faction);
                    String group = root(faction, parent) + "|" + Keys.matchName(i.data().path("name").asText(i.key()));
                    byName.computeIfAbsent(group, g -> new LinkedHashSet<>()).add(i.key());
                }
            }
            for (Set<String> keys : byName.values()) {
                if (keys.size() < 2) continue;
                String best = null;
                int bestDepth = -1;
                boolean oneLineage = true;
                for (String k : keys) {
                    int d = depth(factionOf.get(k), parent);
                    if (d > bestDepth) {
                        best = k;
                        bestDepth = d;
                    }
                }
                for (String k : keys) {
                    if (!k.equals(best) && !isAncestor(factionOf.get(k), factionOf.get(best), parent)) oneLineage = false;
                }
                if (!oneLineage) continue;
                for (String k : keys) {
                    if (!k.equals(best)) {
                        remap.put(k, best);
                        issues.add(new ImportReport.Issue(ImportReport.Level.INFO, "key-aligned",
                                k + " is filed as " + best + " (same name, more specific faction)", Optional.empty(), Optional.of(k)));
                    }
                }
            }
        }
        if (remap.isEmpty()) return new Result(sources, issues);

        Map<Source, SourceSet> out = new EnumMap<>(Source.class);
        for (var e : sources.entrySet()) {
            List<SourceSet.Item> items = new ArrayList<>();
            for (SourceSet.Item i : e.getValue().items()) {
                ObjectNode data = i.data().deepCopy();
                String newKey = rewrite(i.key(), remap);
                rewriteRefs(data, remap);
                if ((i.type() == EntityType.DATASHEET || i.type() == EntityType.DETACHMENT) && remap.containsKey(i.key())) {
                    data.put("faction", factionOf.get(newKey));
                }
                data.put("key", newKey);
                items.add(new SourceSet.Item(i.type(), newKey, data, i.externalId()));
            }
            out.put(e.getKey(), new SourceSet(e.getValue().source(), dedupe(items), e.getValue().report()));
        }
        return new Result(out, issues);
    }

    private static List<SourceSet.Item> dedupe(List<SourceSet.Item> items) {
        Map<String, SourceSet.Item> map = new LinkedHashMap<>();
        for (SourceSet.Item i : items) map.putIfAbsent(i.type() + "|" + i.key(), i);
        return new ArrayList<>(map.values());
    }

    private static final Set<String> REF_FIELDS = Set.of("datasheet", "ownerKey", "detachment", "leaderOf", "eligibleDatasheets", "grantsLeaderOf");

    private static void rewriteRefs(ObjectNode data, Map<String, String> remap) {
        for (String f : REF_FIELDS) {
            JsonNode v = data.get(f);
            if (v == null) continue;
            if (v.isTextual()) data.put(f, rewrite(v.asText(), remap));
            else if (v.isArray()) {
                ArrayNode arr = (ArrayNode) v;
                for (int n = 0; n < arr.size(); n++) {
                    if (arr.get(n).isTextual()) arr.set(n, TextNode.valueOf(rewrite(arr.get(n).asText(), remap)));
                }
            }
        }
    }

    static String rewrite(String key, Map<String, String> remap) {
        if (remap.containsKey(key)) return remap.get(key);
        for (var e : remap.entrySet()) {
            if (key.startsWith(e.getKey() + ":")) return e.getValue() + key.substring(e.getKey().length());
        }
        return key;
    }

    private static String root(String faction, Map<String, String> parent) {
        String f = faction;
        for (int n = 0; n < 6 && parent.containsKey(f); n++) f = parent.get(f);
        return f;
    }

    private static int depth(String faction, Map<String, String> parent) {
        int d = 0;
        String f = faction;
        while (f != null && parent.containsKey(f) && d < 6) {
            f = parent.get(f);
            d++;
        }
        return d;
    }

    private static boolean isAncestor(String ancestor, String of, Map<String, String> parent) {
        String f = of;
        for (int n = 0; n < 7 && f != null; n++) {
            if (f.equals(ancestor)) return true;
            f = parent.get(f);
        }
        return false;
    }
}
