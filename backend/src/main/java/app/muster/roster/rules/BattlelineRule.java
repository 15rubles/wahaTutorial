package app.muster.roster.rules;

import app.muster.gamedata.model.BattleSize;
import app.muster.roster.model.RosterSnapshot;
import java.util.List;
import java.util.Optional;

/** Minimum number of battleline units, only when the battle size data defines one. */
public final class BattlelineRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        Optional<Integer> min = data.battleSize(roster).flatMap(s -> s.limit(BattleSize.LIMIT_MIN_BATTLELINE));
        if (min.isEmpty()) return List.of();
        long count = roster.entries().stream()
                .filter(e -> data.datasheet(e.datasheetKey()).map(RosterData::isBattleline).orElse(false))
                .count();
        if (count < min.get()) {
            return List.of(Violation.error("BATTLELINE_MINIMUM", "The army needs at least " + min.get() + " battleline units, it has " + count));
        }
        return List.of();
    }
}
