package app.muster.health;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class HealthControllerIT extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void healthIsUpWhenDatabaseIsReachable() {
        var res = newClient().get("/api/health").expectStatus(200).json();
        assertThat(res.get("status").asText()).isEqualTo("UP");
        assertThat(res.get("database").asText()).isEqualTo("UP");
        assertThat(res.get("checkedAt").asText()).isNotBlank();
    }

    @Test
    void flywayAppliedMigrations() {
        Integer applied = jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success", Integer.class);
        assertThat(applied).isEqualTo(1);
    }

    @Test
    void unknownApiPathUsesTheSharedErrorShape() {
        var res = adminClient().get("/api/does-not-exist").expectStatus(404).json();
        assertThat(res.get("code").asText()).isEqualTo("NOT_FOUND");
        assertThat(res.get("fieldErrors").isArray()).isTrue();
    }
}
