package app.muster.roster.rules;

import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Detachment;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Detachment points vs. the battle size budget, at least one detachment, no detachment twice. */
public final class DetachmentBudgetRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        Optional<BattleSize> size = data.battleSize(roster);
        int min = size.flatMap(s -> s.limit(BattleSize.LIMIT_MIN_DETACHMENTS)).orElse(1);
        if (roster.detachments().size() < min) {
            out.add(Violation.error("NO_DETACHMENT", min == 1 ? "Choose at least one detachment" : "Choose at least " + min + " detachments"));
        }
        Set<String> seen = new HashSet<>();
        int total = 0;
        boolean costKnown = true;
        for (String key : roster.detachments()) {
            if (!seen.add(key)) {
                out.add(Violation.error("DUPLICATE_DETACHMENT", "The same detachment cannot be selected twice"));
                continue;
            }
            Optional<Detachment> d = data.detachment(key);
            if (d.isEmpty()) {
                out.add(Violation.error("UNKNOWN_DETACHMENT", "A selected detachment is not available to this faction in the current data"));
                continue;
            }
            Optional<Integer> dp = data.dpCost(d.get());
            if (dp.isEmpty()) {
                costKnown = false;
                out.add(Violation.warning("MISSING_DP", d.get().name() + " has no detachment point cost in the data"));
            } else {
                total += dp.get();
            }
        }
        if (size.isEmpty()) return out;
        Optional<Integer> budget = size.get().dpBudget();
        if (budget.isEmpty()) {
            out.add(Violation.info("NO_DP_BUDGET", size.get().name() + " has no detachment point budget in the data, not checked"));
            return out;
        }
        Optional<Integer> single = size.get().limit(BattleSize.LIMIT_SINGLE_DETACHMENT_DP);
        boolean singleAllowance = roster.detachments().size() == 1 && single.isPresent() && total <= single.get();
        if (total > budget.get() && !singleAllowance) {
            out.add(Violation.error("DP_BUDGET", "Detachments cost " + total + " DP, the budget for " + size.get().name()
                    + " is " + budget.get() + (single.isPresent() ? " (or one detachment of up to " + single.get() + " DP)" : "")));
        }
        if (!costKnown) out.add(Violation.info("DP_INCOMPLETE", "The detachment point total is incomplete"));
        return out;
    }

    /** Total DP of the roster's detachments (unknown costs count as 0). */
    public static int total(RosterSnapshot roster, RosterData data) {
        int total = 0;
        for (String key : new java.util.LinkedHashSet<>(roster.detachments())) {
            total += data.detachment(key).flatMap(data::dpCost).orElse(0);
        }
        return total;
    }
}
