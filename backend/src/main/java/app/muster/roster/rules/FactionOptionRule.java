package app.muster.roster.rules;

import app.muster.gamedata.model.FactionOption;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.List;

/** Faction-wide options the data defines must be chosen, with a value the data lists. */
public final class FactionOptionRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        for (FactionOption o : data.faction().factionOptions()) {
            String chosen = roster.factionOptions().get(o.key());
            if (chosen == null) {
                out.add(Violation.warning("FACTION_OPTION", "Choose " + o.name()));
            } else if (o.values().stream().noneMatch(v -> v.name().equals(chosen))) {
                out.add(Violation.error("FACTION_OPTION_VALUE", chosen + " is not a choice of " + o.name()));
            }
        }
        return out;
    }
}
