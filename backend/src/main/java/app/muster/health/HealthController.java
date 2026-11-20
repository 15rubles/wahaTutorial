package app.muster.health;

import java.time.Clock;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public HealthController(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @GetMapping
    public ResponseEntity<HealthResponse> health() {
        HealthStatus db = checkDatabase();
        HealthResponse body = new HealthResponse(db, db, Instant.now(clock));
        HttpStatus code = db == HealthStatus.UP ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
        return ResponseEntity.status(code).body(body);
    }

    private HealthStatus checkDatabase() {
        try {
            Integer one = jdbc.queryForObject("SELECT 1", Integer.class);
            return Integer.valueOf(1).equals(one) ? HealthStatus.UP : HealthStatus.DOWN;
        } catch (RuntimeException e) {
            return HealthStatus.DOWN;
        }
    }
}
