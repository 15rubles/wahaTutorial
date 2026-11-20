package app.muster.roster.rules;

import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import app.muster.roster.model.WargearChoice;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Chosen wargear must exist and respect the option's minimum and maximum for the unit size. */
public final class WargearRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        for (RosterEntry e : roster.entries()) {
            if (data.datasheet(e.datasheetKey()).isEmpty()) continue;
            List<WargearOption> options = data.wargear(e.datasheetKey());
            int models = data.size(e.datasheetKey(), e.sizeKey()).map(UnitSizeOption::models).orElse(1);
            Map<String, Integer> perOption = new HashMap<>();
            for (WargearChoice w : e.wargear()) {
                Optional<WargearOption> o = options.stream().filter(x -> x.key().equals(w.option())).findFirst();
                if (o.isEmpty()) {
                    out.add(Violation.error("UNKNOWN_WARGEAR", "A wargear choice is not in the current data", e.id()));
                    continue;
                }
                if (!o.get().choices().isEmpty() && o.get().choices().stream().noneMatch(c -> c.equalsIgnoreCase(w.choice()))) {
                    out.add(Violation.error("UNKNOWN_WARGEAR", w.choice() + " is not a choice of " + o.get().name(), e.id()));
                }
                perOption.merge(o.get().key(), w.count(), Integer::sum);
            }
            for (WargearOption o : options) {
                int taken = perOption.getOrDefault(o.key(), 0);
                Optional<Integer> max = o.max().map(m -> o.perModels().map(per -> m * Math.max(1, models / per)).orElse(m));
                if (max.isPresent() && taken > max.get()) {
                    out.add(Violation.error("WARGEAR_MAX", o.name() + ": " + taken + " taken, at most " + max.get() + " for " + models + " models", e.id()));
                }
                if (o.min().isPresent() && taken < o.min().get()) {
                    out.add(Violation.error("WARGEAR_MIN", o.name() + ": at least " + o.min().get() + " needed", e.id()));
                }
            }
        }
        return out;
    }
}
