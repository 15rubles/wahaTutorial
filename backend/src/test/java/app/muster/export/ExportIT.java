package app.muster.export;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.support.IntegrationTest;
import app.muster.support.TestClient;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class ExportIT extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void exportDataHasEverythingThePdfNeeds() {
        jdbc.update("DELETE FROM manual_override");
        importAllAndActivate(adminClient());
        TestClient user = registeredUser("exp");
        long id = user.post("/api/rosters", "{\"name\":\"Export\",\"factionKey\":\"rust-pilgrims\"}").expectStatus(201).json().get("id").asLong();
        user.put("/api/rosters/" + id + "/detachments", "{\"detachmentKeys\":[\"rust-pilgrims:det:pilgrimage-of-iron\"]}").expectStatus(200);
        user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:rust-prophet\"}").expectStatus(201);

        JsonNode x = user.get("/api/rosters/" + id + "/export-data").expectStatus(200).json();
        assertThat(x.at("/roster/name").asText()).isEqualTo("Export");
        assertThat(x.at("/faction/name").asText()).isEqualTo("Rust Pilgrims");
        assertThat(x.at("/selectedDetachments/0/detachment/name").asText()).isEqualTo("Pilgrimage of Iron");
        assertThat(x.at("/selectedDetachments/0/stratagems")).hasSize(1);
        assertThat(x.at("/otherDetachments/0/detachment/name").asText()).isEqualTo("Ember Host");
        assertThat(x.get("coreStratagems")).isNotEmpty();
        assertThat(x.at("/datasheets/rust-pilgrims:rust-prophet/datasheet/name").asText()).isEqualTo("Rust Prophet");
        assertThat(x.at("/datasheets/rust-pilgrims:rust-prophet/weapons")).isNotEmpty();
        // Glossary: Rending Edge (on a weapon), Critical Strike (in its text, one level deep).
        assertThat(x.get("glossary").has("g:rending-edge")).isTrue();
        assertThat(x.get("glossary").has("g:critical-strike")).isTrue();
        assertThat(x.at("/glossary/g:rending-edge/referencedBy")).isEmpty();
        assertThat(x.at("/dataVersion/id").asLong()).isPositive();

        registeredUser("other").get("/api/rosters/" + id + "/export-data").expectStatus(404);
    }

    @Test
    void presets() {
        TestClient user = registeredUser("pre");
        user.post("/api/me/export-presets", "{\"name\":\"Tournament\",\"settings\":{\"paper\":\"A4\"}}").expectStatus(201);
        user.post("/api/me/export-presets", "{\"name\":\"Tournament\",\"settings\":{\"paper\":\"LETTER\"}}").expectStatus(201);
        JsonNode list = user.get("/api/me/export-presets").expectStatus(200).json();
        assertThat(list).hasSize(1);
        assertThat(list.at("/0/settings/paper").asText()).isEqualTo("LETTER");
        assertThat(registeredUser("pre2").get("/api/me/export-presets").json()).isEmpty();
        assertThat(user.post("/api/me/export-presets", "{\"name\":\"x\",\"settings\":[1]}").expectStatus(400).errorCode()).isEqualTo("BAD_SETTINGS");
        user.delete("/api/me/export-presets/" + list.at("/0/id").asLong()).expectStatus(204);
        assertThat(user.get("/api/me/export-presets").json()).isEmpty();
    }
}
