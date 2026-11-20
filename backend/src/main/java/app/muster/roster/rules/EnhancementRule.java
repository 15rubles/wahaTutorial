package app.muster.roster.rules;

import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Enhancement;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Enhancements: from a selected detachment; eligibility from the data (listed units, required and
 * forbidden keywords); CHARACTER only and no EPIC HERO unless it is an Upgrade; no duplicates (Upgrades
 * up to the data's limit); at most one per unit, counting an attached unit as one unit; and the battle
 * size's enhancement limit (repeated Upgrades count once).
 */
public final class EnhancementRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        Optional<BattleSize> size = data.battleSize(roster);
        Set<String> detachments = new HashSet<>(roster.detachments());
        Map<String, List<Long>> uses = new LinkedHashMap<>();
        Map<String, Enhancement> known = new LinkedHashMap<>();

        for (RosterEntry e : roster.entries()) {
            if (e.enhancementKey().isEmpty()) continue;
            String key = e.enhancementKey().get();
            Optional<Enhancement> en = data.enhancement(key);
            if (en.isEmpty()) {
                out.add(Violation.error("UNKNOWN_ENHANCEMENT", "An enhancement is not in the current data", e.id()));
                continue;
            }
            Enhancement x = en.get();
            known.put(key, x);
            uses.computeIfAbsent(key, k -> new ArrayList<>()).add(e.id());
            if (!detachments.contains(x.detachment())) {
                out.add(Violation.error("ENHANCEMENT_DETACHMENT", x.name() + " comes from a detachment that is not selected", e.id()));
            }
            Optional<Datasheet> d = data.datasheet(e.datasheetKey());
            if (d.isEmpty()) continue;
            if (!x.upgrade()) {
                if (!RosterData.isCharacter(d.get())) {
                    out.add(Violation.error("ENHANCEMENT_NOT_CHARACTER", d.get().name() + " is not a CHARACTER and cannot take " + x.name(), e.id()));
                }
                if (RosterData.isEpicHero(d.get())) {
                    out.add(Violation.error("ENHANCEMENT_EPIC_HERO", d.get().name() + " is an EPIC HERO and cannot take enhancements", e.id()));
                }
            }
            if (!x.eligibleDatasheets().isEmpty() && !x.eligibleDatasheets().contains(e.datasheetKey())) {
                out.add(Violation.error("ENHANCEMENT_ELIGIBILITY", d.get().name() + " cannot take " + x.name(), e.id()));
            } else {
                for (String k : x.requiredKeywords()) {
                    if (!RosterData.hasKeyword(d.get(), k)) {
                        out.add(Violation.error("ENHANCEMENT_ELIGIBILITY", x.name() + " needs a " + k.toUpperCase(java.util.Locale.ROOT) + " model", e.id()));
                    }
                }
            }
            for (String k : x.forbiddenKeywords()) {
                if (RosterData.hasKeyword(d.get(), k)) {
                    out.add(Violation.error("ENHANCEMENT_ELIGIBILITY", x.name() + " cannot go on a " + k.toUpperCase(java.util.Locale.ROOT) + " model", e.id()));
                }
            }
        }

        Optional<Integer> sameUpgrade = size.flatMap(s -> s.limit(BattleSize.LIMIT_MAX_SAME_UPGRADE));
        int counted = 0;
        for (var u : uses.entrySet()) {
            Enhancement x = known.get(u.getKey());
            int n = u.getValue().size();
            counted += 1;
            if (!x.upgrade() && n > 1) {
                out.add(new Violation(Severity.ERROR, "DUPLICATE_ENHANCEMENT", x.name() + " is taken " + n + " times, the army can only include it once", u.getValue()));
            }
            if (x.upgrade() && sameUpgrade.isPresent() && n > sameUpgrade.get()) {
                out.add(new Violation(Severity.ERROR, "UPGRADE_LIMIT", x.name() + " is taken " + n + " times, the limit is " + sameUpgrade.get(), u.getValue()));
            }
            if (x.upgrade() && sameUpgrade.isEmpty() && n > 1) {
                out.add(new Violation(Severity.INFO, "UPGRADE_LIMIT_UNKNOWN", "No limit for repeated upgrades in the data, " + x.name() + " not checked", u.getValue()));
            }
        }
        size.flatMap(s -> s.limit(BattleSize.LIMIT_ENHANCEMENTS)).ifPresent(limit -> {
            if (uses.size() > limit) {
                out.add(Violation.error("ENHANCEMENT_LIMIT", uses.size() + " enhancements, the limit for " + size.get().name() + " is " + limit));
            }
        });
        if (counted == 0) return out;

        // One enhancement per unit, an attached unit counting as one.
        Map<Long, List<Long>> groups = attachedGroups(roster);
        for (List<Long> group : groups.values()) {
            List<Long> withEnh = group.stream()
                    .filter(id -> roster.entry(id).flatMap(RosterEntry::enhancementKey).isPresent())
                    .toList();
            if (withEnh.size() > 1) {
                out.add(new Violation(Severity.ERROR, "ONE_ENHANCEMENT_PER_UNIT", "An attached unit can only have one enhancement", withEnh));
            }
        }
        return out;
    }

    /** Bodyguard id -> ids of the bodyguard and everything attached to it. */
    static Map<Long, List<Long>> attachedGroups(RosterSnapshot roster) {
        Map<Long, List<Long>> groups = new LinkedHashMap<>();
        for (RosterEntry e : roster.entries()) {
            long root = e.attachedTo().filter(t -> roster.entry(t).isPresent()).orElse(e.id());
            groups.computeIfAbsent(root, k -> new ArrayList<>()).add(e.id());
        }
        return groups;
    }
}
