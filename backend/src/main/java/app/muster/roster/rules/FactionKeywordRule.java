package app.muster.roster.rules;

import app.muster.gamedata.model.Datasheet;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Units must be available to the army's faction (its lineage in the data). Unaligned units are allowed
 * only when the matching show/hide option is on.
 */
public final class FactionKeywordRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        for (RosterEntry e : roster.entries()) {
            Optional<Datasheet> d = data.datasheet(e.datasheetKey());
            if (d.isEmpty()) {
                out.add(Violation.error("UNKNOWN_DATASHEET", "A unit is not in the current data (" + e.datasheetKey() + ")", e.id()));
                continue;
            }
            if (data.isNative(e.datasheetKey())) continue;
            boolean fortification = RosterData.isFortification(d.get());
            boolean allowed = fortification ? roster.flags().unalignedFortifications() : roster.flags().unalignedForces();
            if (!allowed) {
                out.add(Violation.error("FACTION", d.get().name() + " is not part of this faction", e.id()));
            }
        }
        return out;
    }
}
