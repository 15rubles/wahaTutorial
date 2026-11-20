package app.muster.roster.rules;

import app.muster.roster.model.RosterSnapshot;
import java.util.List;

/** One roster building rule. Limits always come from the data, never from code. */
public interface RosterRule {
    List<Violation> check(RosterSnapshot roster, RosterData data);
}
