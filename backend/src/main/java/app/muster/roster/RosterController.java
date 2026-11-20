package app.muster.roster;

import app.muster.auth.AuthUser;
import app.muster.auth.CurrentUser;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rosters")
public class RosterController {

    private final RosterQueries queries;

    public RosterController(RosterQueries queries) {
        this.queries = queries;
    }

    @GetMapping
    public List<RosterSummary> list(@CurrentUser AuthUser me) {
        return queries.listForOwner(me.id());
    }
}
