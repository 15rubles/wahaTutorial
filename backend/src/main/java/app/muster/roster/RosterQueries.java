package app.muster.roster;

import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Read side for the roster list. Full roster model arrives in M4. */
@Repository
public class RosterQueries {

    private final JdbcClient jdbc;

    public RosterQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<RosterSummary> listForOwner(long ownerId) {
        return jdbc.sql("SELECT id, name, created_at, updated_at FROM roster WHERE owner_id = ? ORDER BY updated_at DESC")
                .param(ownerId)
                .query((rs, i) -> new RosterSummary(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()))
                .list();
    }
}
