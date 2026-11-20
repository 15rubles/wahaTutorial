package app.muster.roster.rules;

import app.muster.gamedata.model.Datasheet;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Legends units only when the roster shows Legends. */
public final class LegendsRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        if (roster.flags().legends()) return List.of();
        List<Violation> out = new ArrayList<>();
        for (RosterEntry e : roster.entries()) {
            Optional<Datasheet> d = data.datasheet(e.datasheetKey());
            if (d.isPresent() && d.get().legends()) {
                out.add(Violation.error("LEGENDS", d.get().name() + " is a Legends unit; turn on Legends in the show/hide options", e.id()));
            }
        }
        return out;
    }
}
