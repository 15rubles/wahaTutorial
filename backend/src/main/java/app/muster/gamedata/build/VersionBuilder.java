package app.muster.gamedata.build;

import app.muster.gamedata.build.ImportReport.Issue;
import app.muster.gamedata.build.ImportReport.Level;
import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.RulesText;
import app.muster.gamedata.model.Source;
import app.muster.gamedata.model.Token;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

/**
 * Builds the content of a data version from the latest source set of each source plus manual
 * overrides. Pure: no database, so every rule here is unit tested.
 *
 * <p>Steps: merge per field by {@link MergePolicy}, drop unmatched points rows, apply overrides,
 * add plain keyword glossary entries, link rules text, infer missing phase tags, build the glossary
 * reverse index, validate every entity, and diff against the previous version.
 */
public final class VersionBuilder {

    private static final int MAX_REFERENCES = 300;

    public record Input(
            Map<Source, SourceSet> sources,
            Map<Source, Long> importIds,
            List<Override> overrides,
            Optional<PreviousVersion> previous) {}

    /** What the previous active version contained, for the diff. */
    public record PreviousVersion(long versionId, Map<String, GameEntity> entitiesByTypeAndKey) {}

    public record Result(List<BuiltEntity> entities, VersionReport report) {}

    private record Key(EntityType type, String key) {
        String id() {
            return type + "|" + key;
        }
    }

    private static final class Working {
        ObjectNode data;
        Source source;
        final Map<String, Source> provenance = new TreeMap<>();
        final Map<Source, String> externalIds = new EnumMap<>(Source.class);
    }

    private final List<Issue> issues = new ArrayList<>();

    public static Result build(Input input) {
        return new VersionBuilder().run(input);
    }

    private Result run(Input input) {
        for (SourceSet set : input.sources().values()) {
            for (Issue i : set.report().issues()) {
                issues.add(new Issue(i.level(), set.source().name().toLowerCase() + "/" + i.category(), i.message(), i.faction(), i.ref()));
            }
        }

        KeyAligner.Result aligned = KeyAligner.align(input.sources());
        issues.addAll(aligned.issues());
        Map<Key, Map<Source, SourceSet.Item>> grouped = group(aligned.sources());
        pickChildSets(grouped, EntityType.UNIT_SIZE, "points");
        pickChildSets(grouped, EntityType.WARGEAR_OPTION, "choices");
        dropUnmatched(grouped);

        Map<Key, Working> merged = new LinkedHashMap<>();
        for (var e : grouped.entrySet()) {
            merged.put(e.getKey(), merge(e.getKey().type(), e.getValue()));
        }
        int overridesApplied = applyOverrides(merged, input.overrides());
        dropOrphans(merged);
        addKeywordGlossary(merged);

        List<GlossaryEntry> glossary = new ArrayList<>();
        for (var e : merged.entrySet()) {
            if (e.getKey().type() == EntityType.GLOSSARY) {
                tryParse(e.getKey(), e.getValue().data).map(GlossaryEntry.class::cast).ifPresent(glossary::add);
            }
        }
        RulesTextLinker linker = new RulesTextLinker(glossary);

        Map<String, Set<GlossaryEntry.Reference>> refs = new HashMap<>();
        for (var e : merged.entrySet()) {
            Key k = e.getKey();
            ObjectNode data = e.getValue().data;
            inferPhases(k.type(), data);
            Optional<String> self = k.type() == EntityType.GLOSSARY ? Optional.of(k.key()) : Optional.empty();
            Set<String> referenced = new LinkedHashSet<>();
            linkTexts(data, linker, self, referenced);
            if (k.type() == EntityType.WEAPON) linkWeaponKeywords(data, linker, referenced);
            if (k.type() == EntityType.ABILITY && !data.hasNonNull("glossaryId")) {
                linker.resolve(data.path("name").asText()).ifPresent(g -> data.put("glossaryId", g));
            }
            String name = data.path(k.type() == EntityType.GLOSSARY ? "term" : "name").asText(k.key());
            for (String g : referenced) {
                refs.computeIfAbsent(g, x -> new LinkedHashSet<>()).add(new GlossaryEntry.Reference(k.type(), k.key(), name));
            }
        }
        for (var e : merged.entrySet()) {
            if (e.getKey().type() != EntityType.GLOSSARY) continue;
            List<GlossaryEntry.Reference> list = new ArrayList<>(refs.getOrDefault(e.getKey().key(), Set.of()));
            list.sort(Comparator.comparing((GlossaryEntry.Reference r) -> r.type().ordinal()).thenComparing(GlossaryEntry.Reference::name));
            if (list.size() > MAX_REFERENCES) list = list.subList(0, MAX_REFERENCES);
            e.getValue().data.set("referencedBy", GameJson.MAPPER.valueToTree(list));
        }

        List<BuiltEntity> out = new ArrayList<>();
        for (var e : merged.entrySet()) {
            Working w = e.getValue();
            tryParse(e.getKey(), w.data).ifPresent(entity -> out.add(new BuiltEntity(entity, w.source, w.provenance, w.externalIds)));
        }

        int review = 0;
        for (BuiltEntity b : out) {
            if (tagsOf(b.entity()).map(PhaseTags::needsReview).orElse(false)) review++;
        }

        Map<String, Long> importIds = new TreeMap<>();
        input.importIds().forEach((s, id) -> importIds.put(s.name(), id));
        VersionReport report = new VersionReport(
                importIds, counts(out), List.copyOf(issues), diff(out, input.previous()), review, overridesApplied);
        return new Result(out, report);
    }

    static Optional<PhaseTags> tagsOf(GameEntity e) {
        return switch (e) {
            case Ability a -> Optional.of(a.tags());
            case app.muster.gamedata.model.Enhancement en -> Optional.of(en.tags());
            case app.muster.gamedata.model.Stratagem s -> Optional.of(s.tags());
            default -> Optional.empty();
        };
    }

    // ---- grouping and merging -------------------------------------------------------------

    private static Map<Key, Map<Source, SourceSet.Item>> group(Map<Source, SourceSet> sources) {
        Map<Key, Map<Source, SourceSet.Item>> grouped = new LinkedHashMap<>();
        // Deterministic order: text priority order, so entity order follows the richest source.
        for (Source s : List.of(Source.WAHAPEDIA, Source.BATTLESCRIBE, Source.MFM)) {
            SourceSet set = sources.get(s);
            if (set == null) continue;
            for (SourceSet.Item item : set.items()) {
                grouped.computeIfAbsent(new Key(item.type(), item.key()), k -> new EnumMap<>(Source.class)).put(s, item);
            }
        }
        return grouped;
    }

    /**
     * Which unit sizes (or wargear options) a datasheet has comes from the highest priority source
     * that lists any for it. Entries only a lower priority source knows are dropped and reported.
     */
    private void pickChildSets(Map<Key, Map<Source, SourceSet.Item>> grouped, EntityType type, String priorityField) {
        Map<String, Set<Source>> sourcesPerSheet = new HashMap<>();
        for (var e : grouped.entrySet()) {
            if (e.getKey().type() != type) continue;
            String sheet = e.getValue().values().iterator().next().data().path("datasheet").asText();
            sourcesPerSheet.computeIfAbsent(sheet, x -> new HashSet<>()).addAll(e.getValue().keySet());
        }
        for (var e : grouped.entrySet()) {
            if (e.getKey().type() != type) continue;
            String sheet = e.getValue().values().iterator().next().data().path("datasheet").asText();
            Set<Source> available = sourcesPerSheet.get(sheet);
            Source best = MergePolicy.priority(type, priorityField).stream()
                    .filter(available::contains)
                    .findFirst()
                    .orElseThrow();
            if (!e.getValue().containsKey(best)) {
                issues.add(new Issue(Level.INFO, type.name().toLowerCase().replace('_', '-') + "-dropped",
                        e.getKey().key() + " is not listed by " + best + ", dropped",
                        Optional.empty(), Optional.of(e.getKey().key())));
                e.getValue().clear();
            }
        }
        grouped.values().removeIf(Map::isEmpty);
    }

    /**
     * Points-only rows (MFM) must match an entity another source knows. A row filed under a related
     * faction (parent or chapter) is moved to the matching entity first; anything still unmatched is
     * reported, never silently dropped.
     */
    private void dropUnmatched(Map<Key, Map<Source, SourceSet.Item>> grouped) {
        Map<String, String> parent = new HashMap<>();
        for (var e : grouped.entrySet()) {
            if (e.getKey().type() != EntityType.FACTION) continue;
            for (SourceSet.Item i : e.getValue().values()) {
                if (i.data().hasNonNull("parentKey")) parent.putIfAbsent(e.getKey().key(), i.data().get("parentKey").asText());
            }
        }
        Set<String> known = new HashSet<>();
        Map<String, String> byLineageName = new HashMap<>();
        for (var e : grouped.entrySet()) {
            if (e.getValue().keySet().stream().noneMatch(s -> s != Source.MFM)) continue;
            known.add(e.getKey().id());
            if (e.getKey().type() == EntityType.DATASHEET || e.getKey().type() == EntityType.ENHANCEMENT) {
                byLineageName.putIfAbsent(e.getKey().type() + "|" + lineageName(e.getKey().key(), parent), e.getKey().key());
            }
        }
        List<Map.Entry<Key, SourceSet.Item>> moves = new ArrayList<>();
        var it = grouped.entrySet().iterator();
        while (it.hasNext()) {
            var e = it.next();
            if (!e.getValue().keySet().equals(Set.of(Source.MFM))) continue;
            Key k = e.getKey();
            SourceSet.Item item = e.getValue().get(Source.MFM);
            ObjectNode data = item.data();
            boolean matched = k.type() == EntityType.UNIT_SIZE
                    && known.contains(new Key(EntityType.DATASHEET, data.path("datasheet").asText()).id());
            if (!matched && k.type() == EntityType.UNIT_SIZE) {
                String sheet = data.path("datasheet").asText();
                String target = byLineageName.get(EntityType.DATASHEET + "|" + lineageName(sheet, parent));
                if (target != null) {
                    ObjectNode moved = data.deepCopy();
                    moved.put("datasheet", target);
                    String newKey = target + k.key().substring(sheet.length());
                    moved.put("key", newKey);
                    moves.add(Map.entry(new Key(k.type(), newKey), new SourceSet.Item(k.type(), newKey, moved, item.externalId())));
                    it.remove();
                    continue;
                }
            }
            if (!matched && k.type() == EntityType.ENHANCEMENT) {
                String target = byLineageName.get(EntityType.ENHANCEMENT + "|" + lineageName(k.key(), parent));
                if (target != null) {
                    ObjectNode moved = data.deepCopy();
                    moved.put("key", target);
                    moved.remove("detachment");
                    moved.remove("faction");
                    moves.add(Map.entry(new Key(k.type(), target), new SourceSet.Item(k.type(), target, moved, item.externalId())));
                    it.remove();
                    continue;
                }
            }
            if (!matched) {
                String what = k.type() == EntityType.UNIT_SIZE ? data.path("datasheet").asText() : k.key();
                issues.add(new Issue(Level.WARNING, "unmatched",
                        "MFM " + k.type().name().toLowerCase().replace('_', ' ') + " '" + data.path("name").asText(what)
                                + "' (" + what + ") matches no " + (k.type() == EntityType.UNIT_SIZE ? "datasheet" : "entity"),
                        Optional.ofNullable(data.path("faction").asText(null)), Optional.of(k.key())));
                it.remove();
            }
        }
        for (var m : moves) {
            grouped.computeIfAbsent(m.getKey(), x -> new EnumMap<>(Source.class)).putIfAbsent(Source.MFM, m.getValue());
        }
    }

    /** "blood-angels:sanguinary-guard" -> "space-marines|sanguinary-guard" (root faction + rest of key). */
    private static String lineageName(String key, Map<String, String> parent) {
        int colon = key.indexOf(':');
        if (colon < 0) return key;
        String f = key.substring(0, colon);
        for (int n = 0; n < 6 && parent.containsKey(f); n++) f = parent.get(f);
        String rest = key.substring(colon + 1);
        // Plural or singular unit names should still match.
        String[] parts = rest.split(":");
        parts[0] = Keys.matchName(parts[0].replace('-', ' '));
        return f + "|" + String.join(":", parts);
    }

    private static Working merge(EntityType type, Map<Source, SourceSet.Item> bySource) {
        Working w = new Working();
        w.data = GameJson.MAPPER.createObjectNode();
        Set<String> fields = new LinkedHashSet<>();
        bySource.values().forEach(i -> i.data().fieldNames().forEachRemaining(fields::add));
        for (String field : fields) {
            List<Source> order = MergePolicy.priority(type, field);
            JsonNode chosen = null;
            Source from = null;
            for (Source s : order) {
                SourceSet.Item item = bySource.get(s);
                if (item == null || !item.data().has(field)) continue;
                JsonNode v = item.data().get(field);
                if (isPresent(v)) {
                    chosen = v;
                    from = s;
                    break;
                }
                if (chosen == null) {
                    chosen = v;
                    from = s;
                }
            }
            if (chosen != null) {
                w.data.set(field, chosen.deepCopy());
                if (!field.equals("key")) w.provenance.put(field, from);
            }
        }
        bySource.forEach((s, item) -> item.externalId().ifPresent(id -> w.externalIds.put(s, id)));
        w.source = MergePolicy.priority(type, "name").stream().filter(bySource::containsKey).findFirst().orElseThrow();
        return w;
    }

    static boolean isPresent(JsonNode v) {
        if (v == null || v.isNull() || v.isMissingNode()) return false;
        if (v.isTextual()) return !v.asText().isBlank();
        if (v.isArray()) return !v.isEmpty();
        if (v.isObject()) {
            if (v.has("plain")) return !v.path("plain").asText().isBlank();
            if (v.has("phases")) return !v.path("phases").isEmpty();
            return !v.isEmpty();
        }
        return true;
    }

    // ---- overrides ----------------------------------------------------------------------------

    private int applyOverrides(Map<Key, Working> merged, List<Override> overrides) {
        int applied = 0;
        // Whole-entity overrides first, so field overrides can refine them.
        List<Override> ordered = new ArrayList<>(overrides);
        ordered.sort(Comparator.comparing((Override o) -> !o.isWholeEntity()).thenComparing(Override::id));
        for (Override o : ordered) {
            Key k = new Key(o.type(), o.key());
            if (o.isWholeEntity()) {
                if (!o.value().isObject()) {
                    issues.add(new Issue(Level.ERROR, "override", "Override " + o.id() + " for " + o.key() + " is not an object",
                            Optional.empty(), Optional.of(o.key())));
                    continue;
                }
                Working w = new Working();
                w.data = ((ObjectNode) o.value()).deepCopy();
                w.data.put("key", o.key());
                w.source = Source.MANUAL;
                w.data.fieldNames().forEachRemaining(f -> {
                    if (!f.equals("key")) w.provenance.put(f, Source.MANUAL);
                });
                Working old = merged.get(k);
                if (old != null) w.externalIds.putAll(old.externalIds);
                merged.put(k, w);
                applied++;
                continue;
            }
            Working w = merged.get(k);
            if (w == null) {
                issues.add(new Issue(Level.WARNING, "override-target-missing",
                        "Override of " + o.type() + " " + o.key() + " field " + o.field() + " has no target in this data",
                        Optional.empty(), Optional.of(o.key())));
                continue;
            }
            if (setPath(w.data, o.field(), o.value())) {
                w.provenance.put(o.field().split("\\.")[0], Source.MANUAL);
                applied++;
            } else {
                issues.add(new Issue(Level.WARNING, "override-bad-field",
                        "Override field '" + o.field() + "' does not fit " + o.key(), Optional.empty(), Optional.of(o.key())));
            }
        }
        return applied;
    }

    static boolean setPath(ObjectNode root, String path, JsonNode value) {
        String[] parts = path.split("\\.");
        ObjectNode node = root;
        for (int i = 0; i < parts.length - 1; i++) {
            JsonNode next = node.get(parts[i]);
            if (next == null || next.isNull()) {
                next = node.putObject(parts[i]);
            }
            if (!next.isObject()) return false;
            node = (ObjectNode) next;
        }
        if (parts[parts.length - 1].isBlank()) return false;
        node.set(parts[parts.length - 1], value.deepCopy());
        return true;
    }

    // ---- consistency --------------------------------------------------------------------------

    private void dropOrphans(Map<Key, Working> merged) {
        Set<String> sheets = new HashSet<>();
        Set<String> detachments = new HashSet<>();
        merged.forEach((k, w) -> {
            if (k.type() == EntityType.DATASHEET) sheets.add(k.key());
            if (k.type() == EntityType.DETACHMENT) detachments.add(k.key());
        });
        var it = merged.entrySet().iterator();
        while (it.hasNext()) {
            var e = it.next();
            EntityType t = e.getKey().type();
            String parent = switch (t) {
                case UNIT_SIZE, WEAPON, WARGEAR_OPTION -> e.getValue().data.path("datasheet").asText(null);
                case ENHANCEMENT -> e.getValue().data.path("detachment").asText(null);
                default -> null;
            };
            if (parent == null) continue;
            boolean ok = t == EntityType.ENHANCEMENT ? detachments.contains(parent) : sheets.contains(parent);
            if (!ok) {
                issues.add(new Issue(Level.WARNING, "orphan",
                        t.name().toLowerCase() + " " + e.getKey().key() + " points at missing " + parent + ", dropped",
                        Optional.empty(), Optional.of(e.getKey().key())));
                it.remove();
            }
        }
    }

    /**
     * Plain unit and faction keywords get a glossary entry with no text of their own, so every
     * keyword chip can open a popup (with the reverse index). Never invents rules text.
     */
    private void addKeywordGlossary(Map<Key, Working> merged) {
        Set<String> knownTerms = new HashSet<>();
        merged.forEach((k, w) -> {
            if (k.type() != EntityType.GLOSSARY) return;
            knownTerms.add(RulesTextLinker.normalize(w.data.path("term").asText()));
            w.data.path("aliases").forEach(a -> knownTerms.add(RulesTextLinker.normalize(a.asText())));
        });
        Map<Key, Working> added = new LinkedHashMap<>();
        merged.forEach((k, w) -> {
            if (k.type() != EntityType.DATASHEET) return;
            addKeywords(w.data.path("keywords"), GlossaryKind.UNIT_KEYWORD, knownTerms, merged, added);
            addKeywords(w.data.path("factionKeywords"), GlossaryKind.FACTION_KEYWORD, knownTerms, merged, added);
        });
        merged.putAll(added);
    }

    private static void addKeywords(JsonNode list, GlossaryKind kind, Set<String> known, Map<Key, Working> merged, Map<Key, Working> added) {
        for (JsonNode kw : list) {
            String term = kw.asText().trim();
            String norm = RulesTextLinker.normalize(term);
            if (term.isEmpty() || known.contains(norm)) continue;
            Key key = new Key(EntityType.GLOSSARY, Keys.glossary(term));
            if (merged.containsKey(key) || added.containsKey(key)) {
                known.add(norm);
                continue;
            }
            Working w = new Working();
            w.data = GameJson.toNode(new GlossaryEntry(key.key(), term, List.of(), kind, RulesText.EMPTY, List.of(), List.of()));
            w.source = Source.BATTLESCRIBE;
            added.put(key, w);
            known.add(norm);
        }
    }

    // ---- linking and phases -------------------------------------------------------------------

    /** Every object with a "plain" field is rules text: (re)compute its tokens. */
    private static void linkTexts(JsonNode node, RulesTextLinker linker, Optional<String> self, Set<String> referenced) {
        if (node.isObject()) {
            ObjectNode obj = (ObjectNode) node;
            if (obj.has("plain") && obj.get("plain").isTextual()) {
                List<Token> tokens = linker.link(obj.get("plain").asText(), self);
                for (Token t : tokens) if (t instanceof Token.Ref r) referenced.add(r.glossaryId());
                obj.set("tokens", GameJson.tokens(tokens));
                return;
            }
            obj.fields().forEachRemaining(f -> {
                if (!f.getKey().equals("referencedBy")) linkTexts(f.getValue(), linker, self, referenced);
            });
        } else if (node.isArray()) {
            node.forEach(n -> linkTexts(n, linker, self, referenced));
        }
    }

    private static void linkWeaponKeywords(ObjectNode weapon, RulesTextLinker linker, Set<String> referenced) {
        JsonNode list = weapon.path("abilities");
        if (!list.isArray()) return;
        for (JsonNode ref : list) {
            if (!ref.isObject()) continue;
            ObjectNode o = (ObjectNode) ref;
            if (o.hasNonNull("glossaryId")) {
                referenced.add(o.get("glossaryId").asText());
                continue;
            }
            linker.resolve(o.path("label").asText()).ifPresent(g -> {
                o.put("glossaryId", g);
                referenced.add(g);
            });
        }
    }

    private static void inferPhases(EntityType type, ObjectNode data) {
        if (type != EntityType.ABILITY && type != EntityType.ENHANCEMENT && type != EntityType.STRATAGEM) return;
        JsonNode tags = data.get("tags");
        if (tags != null && tags.isObject() && (tags.path("confirmed").asBoolean() || !tags.path("phases").isEmpty())) return;
        String text = type == EntityType.STRATAGEM
                ? String.join("\n", data.path("when").path("plain").asText(""), data.path("fullText").path("plain").asText(""))
                : data.path("text").path("plain").asText("");
        Optional<PhaseTags> inferred = PhaseInference.infer(text);
        data.set("tags", GameJson.MAPPER.valueToTree(inferred.orElse(PhaseTags.NONE)));
    }

    // ---- validation and report ----------------------------------------------------------------

    private Optional<GameEntity> tryParse(Key k, ObjectNode data) {
        try {
            GameEntity e = GameJson.fromNode(data, k.type());
            if (e.key() == null || e.name() == null || e.name().isBlank()) throw new IllegalArgumentException("missing key or name");
            return Optional.of(e);
        } catch (RuntimeException ex) {
            issues.add(new Issue(Level.ERROR, "invalid", k.type() + " " + k.key() + " is invalid: " + ex.getMessage(),
                    Optional.empty(), Optional.of(k.key())));
            return Optional.empty();
        }
    }

    private static Map<String, Map<String, Integer>> counts(List<BuiltEntity> out) {
        Map<String, Map<String, Integer>> counts = new TreeMap<>();
        Map<String, String> sheetFaction = new HashMap<>();
        Map<String, String> detFaction = new HashMap<>();
        for (BuiltEntity b : out) {
            if (b.entity() instanceof Datasheet d) sheetFaction.put(d.key(), d.faction());
            if (b.entity() instanceof app.muster.gamedata.model.Detachment d) detFaction.put(d.key(), d.faction());
        }
        for (BuiltEntity b : out) {
            String faction = b.entity().factionKey()
                    .or(() -> b.entity().parentKey().map(p -> sheetFaction.getOrDefault(p, detFaction.get(p))))
                    .orElse("core");
            counts.computeIfAbsent(faction == null ? "core" : faction, f -> new TreeMap<>())
                    .merge(b.type().name().toLowerCase(), 1, Integer::sum);
        }
        return counts;
    }

    private static VersionReport.Diff diff(List<BuiltEntity> out, Optional<PreviousVersion> previous) {
        if (previous.isEmpty()) return VersionReport.Diff.NONE;
        Map<String, GameEntity> before = previous.get().entitiesByTypeAndKey();
        Map<String, GameEntity> after = new HashMap<>();
        for (BuiltEntity b : out) after.put(b.type() + "|" + b.key(), b.entity());

        List<VersionReport.Change> added = new ArrayList<>();
        List<VersionReport.Change> removed = new ArrayList<>();
        List<VersionReport.Change> changed = new ArrayList<>();
        List<VersionReport.PointsChange> points = new ArrayList<>();
        Set<EntityType> tracked = Set.of(EntityType.DATASHEET, EntityType.DETACHMENT, EntityType.ENHANCEMENT, EntityType.STRATAGEM);

        for (var e : after.entrySet()) {
            GameEntity now = e.getValue();
            GameEntity old = before.get(e.getKey());
            if (tracked.contains(now.type())) {
                if (old == null) added.add(change(now));
                else if (!GameJson.toNode(old).equals(GameJson.toNode(now))) changed.add(change(now));
            }
            Optional<Integer> pNow = pointsOf(now);
            Optional<Integer> pOld = old == null ? Optional.empty() : pointsOf(old);
            if ((now.type() == EntityType.UNIT_SIZE || now.type() == EntityType.ENHANCEMENT) && old != null && !pNow.equals(pOld)) {
                points.add(new VersionReport.PointsChange(now.type(), now.key(), now.name(), now.factionKey(), pOld, pNow));
            }
        }
        for (var e : before.entrySet()) {
            if (!after.containsKey(e.getKey()) && tracked.contains(e.getValue().type())) removed.add(change(e.getValue()));
        }
        Comparator<VersionReport.Change> byKey = Comparator.comparing(VersionReport.Change::key);
        added.sort(byKey);
        removed.sort(byKey);
        changed.sort(byKey);
        points.sort(Comparator.comparing(VersionReport.PointsChange::key));
        return new VersionReport.Diff(Optional.of(previous.get().versionId()), added, removed, changed, points);
    }

    private static VersionReport.Change change(GameEntity e) {
        return new VersionReport.Change(e.type(), e.key(), e.name(), e.factionKey());
    }

    static Optional<Integer> pointsOf(GameEntity e) {
        return switch (e) {
            case app.muster.gamedata.model.UnitSizeOption u -> u.points();
            case app.muster.gamedata.model.Enhancement en -> en.points();
            default -> Optional.empty();
        };
    }
}
