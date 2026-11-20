package app.muster.roster.rules;

import app.muster.gamedata.model.Datasheet;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Exactly one warlord, and it must be a CHARACTER with the army's faction keyword. */
public final class WarlordRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<RosterEntry> warlords = roster.entries().stream().filter(RosterEntry::warlord).toList();
        if (roster.entries().isEmpty()) return List.of();
        if (warlords.isEmpty()) return List.of(Violation.error("NO_WARLORD", "Choose a warlord"));
        List<Violation> out = new ArrayList<>();
        if (warlords.size() > 1) {
            out.add(new Violation(Severity.ERROR, "MULTIPLE_WARLORDS", "Only one unit can be the warlord",
                    warlords.stream().map(RosterEntry::id).toList()));
        }
        for (RosterEntry w : warlords) {
            Optional<Datasheet> d = data.datasheet(w.datasheetKey());
            if (d.isEmpty()) continue;
            if (!RosterData.isCharacter(d.get())) {
                out.add(Violation.error("WARLORD_NOT_CHARACTER", d.get().name() + " is not a CHARACTER and cannot be the warlord", w.id()));
            } else if (!data.isNative(w.datasheetKey())) {
                // Units of the army's faction lineage carry the army faction keyword; unaligned extras do not.
                out.add(Violation.error("WARLORD_FACTION", d.get().name() + " does not have the army faction keyword", w.id()));
            }
        }
        return out;
    }
}
