package app.muster.roster.rules;

import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

/** Runs every rule and returns the violations, errors first. */
@Component
public class RosterValidator {

    public static final List<RosterRule> RULES = List.of(
            new FactionKeywordRule(),
            new LegendsRule(),
            new PointsLimitRule(),
            new DetachmentBudgetRule(),
            new DetachmentUniqueTagRule(),
            new DatasheetLimitRule(),
            new BattlelineRule(),
            new WarlordRule(),
            new EnhancementRule(),
            new LeaderAttachmentRule(),
            new WargearRule(),
            new ForceDispositionRule(),
            new FactionOptionRule());

    public List<Violation> validate(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        for (RosterRule rule : RULES) out.addAll(rule.check(roster, data));
        out.sort(Comparator.comparing(Violation::severity));
        return out;
    }
}
