package app.muster.health;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.TestcontainersConfig;
import app.muster.web.ApiError;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfig.class)
class HealthControllerIT {

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void healthIsUpWhenDatabaseIsReachable() {
        ResponseEntity<HealthResponse> res = http.getForEntity("/api/health", HealthResponse.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().status()).isEqualTo(HealthStatus.UP);
        assertThat(res.getBody().database()).isEqualTo(HealthStatus.UP);
        assertThat(res.getBody().checkedAt()).isNotNull();
    }

    @Test
    void flywayAppliedBaselineMigration() {
        Integer applied = jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success",
                Integer.class);
        assertThat(applied).isEqualTo(1);
    }

    @Test
    void unknownApiPathUsesTheSharedErrorShape() {
        ResponseEntity<ApiError> res = http.getForEntity("/api/does-not-exist", ApiError.class);

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(res.getBody()).isNotNull();
        assertThat(res.getBody().code()).isEqualTo("NOT_FOUND");
        assertThat(res.getBody().fieldErrors()).isEmpty();
    }
}
