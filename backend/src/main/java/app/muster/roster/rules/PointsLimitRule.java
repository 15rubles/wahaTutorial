package app.muster.roster.rules;

import app.muster.gamedata.model.BattleSize;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Total points vs. the battle size's points limit. */
public final class PointsLimitRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        RosterPricing.Result price = RosterPricing.price(roster, data);
        if (!price.complete()) {
            List<Long> ids = price.entries().entrySet().stream().filter(e -> !e.getValue().complete()).map(java.util.Map.Entry::getKey).toList();
            out.add(new Violation(Severity.WARNING, "MISSING_POINTS",
                    "Some units have no points in the data, so the total is incomplete", ids));
        }
        if (roster.battleSizeKey().isEmpty()) {
            out.add(Violation.warning("NO_BATTLE_SIZE", "Choose a battle size"));
            return out;
        }
        Optional<BattleSize> size = data.battleSize(roster);
        if (size.isEmpty()) {
            out.add(Violation.error("UNKNOWN_BATTLE_SIZE", "The chosen battle size is not in the current data"));
            return out;
        }
        if (size.get().pointsLimit().isEmpty()) {
            out.add(Violation.info("NO_POINTS_LIMIT", size.get().name() + " has no points limit in the data, not checked"));
            return out;
        }
        int limit = size.get().pointsLimit().get();
        if (price.total() > limit) {
            out.add(Violation.error("POINTS_LIMIT", "The army costs " + price.total() + " points, " + (price.total() - limit)
                    + " over the " + limit + " point limit of " + size.get().name()));
        }
        return out;
    }
}
