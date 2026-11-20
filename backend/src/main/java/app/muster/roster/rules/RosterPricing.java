package app.muster.roster.rules;

import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearCost;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import app.muster.roster.model.WargearChoice;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Points of a roster. The n-th copy of a datasheet (in roster order) is priced with the tier that
 * covers n; wargear costs and enhancement points are added. Anything without points in the data is
 * listed as missing, never guessed.
 */
public final class RosterPricing {

    public record EntryPrice(int points, boolean complete, List<String> missing) {}

    public record Result(Map<Long, EntryPrice> entries, int total, boolean complete) {}

    private RosterPricing() {}

    public static Result price(RosterSnapshot roster, RosterData data) {
        Map<Long, EntryPrice> out = new LinkedHashMap<>();
        Map<String, Integer> copies = new HashMap<>();
        int total = 0;
        boolean complete = true;
        for (RosterEntry e : roster.entries()) {
            int copy = copies.merge(e.datasheetKey(), 1, Integer::sum);
            List<String> missing = new ArrayList<>();
            int points = 0;
            Optional<Datasheet> sheet = data.datasheet(e.datasheetKey());
            Optional<UnitSizeOption> size = data.size(e.datasheetKey(), e.sizeKey());
            if (size.isEmpty()) {
                missing.add("unit size");
            } else {
                Optional<String> context = context(size.get(), data.isNative(e.datasheetKey()));
                Optional<Integer> p = size.get().pointsFor(copy, context);
                if (p.isPresent()) points += p.get();
                else missing.add("points for " + size.get().name());
            }
            if (sheet.isPresent()) {
                for (WargearChoice w : e.wargear()) {
                    for (WargearCost c : sheet.get().wargearPoints()) {
                        if (c.name().equalsIgnoreCase(w.choice())) points += c.points() * w.count();
                    }
                }
            }
            if (e.enhancementKey().isPresent()) {
                Optional<Enhancement> en = data.enhancement(e.enhancementKey().get());
                Optional<Integer> p = en.flatMap(Enhancement::points);
                if (p.isPresent()) points += p.get();
                else missing.add("enhancement points");
            }
            boolean ok = missing.isEmpty();
            complete &= ok;
            total += points;
            out.put(e.id(), new EntryPrice(points, ok, missing));
        }
        return new Result(out, total, complete);
    }

    /** Native units use the first pricing context, units from other factions the last one. */
    static Optional<String> context(UnitSizeOption size, boolean nativeUnit) {
        List<String> contexts = size.contexts();
        if (contexts.isEmpty()) return Optional.empty();
        return Optional.of(nativeUnit ? contexts.get(0) : contexts.get(contexts.size() - 1));
    }
}
