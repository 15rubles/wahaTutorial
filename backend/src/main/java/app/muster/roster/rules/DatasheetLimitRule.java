package app.muster.roster.rules;

import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Maximum copies of the same datasheet. The limit comes from the datasheet itself when the data sets
 * one, otherwise from the battle size (with the data's separate limits for epic heroes, battleline and
 * dedicated transports).
 */
public final class DatasheetLimitRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        Map<String, List<Long>> byDatasheet = new LinkedHashMap<>();
        for (RosterEntry e : roster.entries()) byDatasheet.computeIfAbsent(e.datasheetKey(), k -> new ArrayList<>()).add(e.id());
        Optional<BattleSize> size = data.battleSize(roster);
        for (var e : byDatasheet.entrySet()) {
            Optional<Datasheet> d = data.datasheet(e.getKey());
            if (d.isEmpty()) continue;
            Optional<Integer> limit = limit(d.get(), size);
            if (limit.isPresent() && e.getValue().size() > limit.get()) {
                out.add(new Violation(Severity.ERROR, "DATASHEET_LIMIT", d.get().name() + ": " + e.getValue().size()
                        + " units, the limit is " + limit.get(), e.getValue()));
            }
        }
        return out;
    }

    public static Optional<Integer> limit(Datasheet d, Optional<BattleSize> size) {
        if (d.maxCopies().isPresent()) return d.maxCopies();
        if (size.isEmpty()) return Optional.empty();
        BattleSize s = size.get();
        if (RosterData.isEpicHero(d) && s.limit(BattleSize.LIMIT_MAX_COPIES_EPIC_HERO).isPresent()) {
            return s.limit(BattleSize.LIMIT_MAX_COPIES_EPIC_HERO);
        }
        if (RosterData.isBattleline(d) && s.limit(BattleSize.LIMIT_MAX_COPIES_BATTLELINE).isPresent()) {
            return s.limit(BattleSize.LIMIT_MAX_COPIES_BATTLELINE);
        }
        if (RosterData.isDedicatedTransport(d) && s.limit(BattleSize.LIMIT_MAX_COPIES_DEDICATED_TRANSPORT).isPresent()) {
            return s.limit(BattleSize.LIMIT_MAX_COPIES_DEDICATED_TRANSPORT);
        }
        return s.limit(BattleSize.LIMIT_MAX_COPIES);
    }
}
