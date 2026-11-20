package app.muster.gamedata;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.support.Fixtures;
import app.muster.support.IntegrationTest;
import app.muster.support.TestClient;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class GameDataIT extends IntegrationTest {

    /** Imports the invented BattleScribe set and activates it (idempotent across test classes). */
    public static long importAndActivate(TestClient admin) {
        JsonNode res = admin.multipart("/api/admin/imports/battlescribe", "file", "testing-grounds.zip", Fixtures.battleScribeZip())
                .expectStatus(201)
                .json();
        long versionId = res.get("versionId").asLong();
        admin.post("/api/admin/data-versions/" + versionId + "/activate", "").expectStatus(200);
        return versionId;
    }

    @Test
    @Order(1)
    void importBuildsADraftWithAReport() {
        TestClient admin = adminClient();
        JsonNode res = admin.multipart("/api/admin/imports/battlescribe", "file", "testing-grounds.zip", Fixtures.battleScribeZip())
                .expectStatus(201)
                .json();
        long versionId = res.get("versionId").asLong();
        assertThat(res.at("/version/version/status").asText()).isEqualTo("DRAFT");
        assertThat(res.at("/version/entities").asInt()).isGreaterThan(20);

        JsonNode report = admin.get("/api/admin/data-versions/" + versionId + "/report").expectStatus(200).json();
        assertThat(report.at("/counts/rust-pilgrims/datasheet").asInt()).isEqualTo(4);
        assertThat(report.at("/counts/ember-wardens/datasheet").asInt()).isEqualTo(1);
        assertThat(report.get("phaseTagsToReview").asInt()).isGreaterThan(0);
        assertThat(report.at("/sourceImports/BATTLESCRIBE").asLong()).isPositive();

        admin.post("/api/admin/data-versions/" + versionId + "/activate", "").expectStatus(200);
        JsonNode versions = admin.get("/api/admin/data-versions").expectStatus(200).json();
        assertThat(versions.get(0).at("/version/status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    @Order(2)
    void secondImportArchivesThePreviousVersionOnActivate() {
        TestClient admin = adminClient();
        long first = importAndActivate(admin);
        long second = importAndActivate(admin);
        assertThat(second).isGreaterThan(first);
        JsonNode versions = admin.get("/api/admin/data-versions").expectStatus(200).json();
        for (JsonNode v : versions) {
            long id = v.at("/version/id").asLong();
            String status = v.at("/version/status").asText();
            if (id == second) assertThat(status).isEqualTo("ACTIVE");
            if (id == first) assertThat(status).isEqualTo("ARCHIVED");
        }
        JsonNode report = admin.get("/api/admin/data-versions/" + second + "/report").json();
        assertThat(report.at("/diff/comparedToVersion").asLong()).isEqualTo(first);
        assertThat(report.at("/diff/added")).isEmpty();
    }

    @Test
    @Order(3)
    void usersReadTheActiveData() {
        importAndActivate(adminClient());
        TestClient user = registeredUser("reader");

        JsonNode factions = user.get("/api/factions").expectStatus(200).json();
        assertThat(factions.findValuesAsText("key")).contains("rust-pilgrims", "ember-wardens");

        JsonNode sheets = user.get("/api/factions/ember-wardens/datasheets").expectStatus(200).json();
        // The chapter sees its own units and the parent faction's units.
        assertThat(sheets.findValuesAsText("name")).contains("Ember Keeper", "Rust Prophet", "Pilgrim Warband");

        JsonNode filtered = user.get("/api/factions/rust-pilgrims/datasheets?role=Battleline").expectStatus(200).json();
        assertThat(filtered).hasSize(1);
        assertThat(filtered.get(0).get("name").asText()).isEqualTo("Pilgrim Warband");

        JsonNode detail = user.get("/api/datasheets/rust-pilgrims:rust-prophet").expectStatus(200).json();
        assertThat(detail.at("/datasheet/name").asText()).isEqualTo("Rust Prophet");
        assertThat(detail.at("/leads/0/name").asText()).isEqualTo("Pilgrim Warband");
        assertThat(detail.get("weapons")).hasSize(2);
        JsonNode maul = null;
        for (JsonNode w : detail.get("weapons")) if (w.get("name").asText().equals("Censer Maul")) maul = w;
        assertThat(maul).isNotNull();
        assertThat(maul.at("/abilities/0/glossaryId").asText()).isEqualTo("g:rending-edge");

        JsonNode warband = user.get("/api/datasheets/rust-pilgrims:pilgrim-warband").json();
        assertThat(warband.at("/ledBy/0/key").asText()).isEqualTo("rust-pilgrims:rust-prophet");

        JsonNode gl = user.get("/api/glossary/g:rending-edge").expectStatus(200).json();
        assertThat(gl.at("/entry/kind").asText()).isEqualTo("WEAPON_ABILITY");
        JsonNode tokens = gl.at("/entry/text/tokens");
        boolean linksCritical = false;
        for (JsonNode t : tokens) if (t.get("type").asText().equals("ref") && t.get("glossaryId").asText().equals("g:critical-strike")) linksCritical = true;
        assertThat(linksCritical).isTrue();

        assertThat(user.get("/api/glossary/search?q=shock").json().findValuesAsText("key")).contains("g:shock-strike");
        java.util.List<String> sizeNames = new java.util.ArrayList<>();
        user.get("/api/battle-sizes").json().forEach(b -> sizeNames.add(b.get("name").asText()));
        assertThat(sizeNames).contains("Skirmish", "Grand Clash");
        assertThat(sizeNames.indexOf("Skirmish")).isLessThan(sizeNames.indexOf("Grand Clash"));

        JsonNode dets = user.get("/api/factions/rust-pilgrims/detachments").expectStatus(200).json();
        assertThat(dets.findValuesAsText("name")).contains("Pilgrimage of Iron", "Ember Host");

        user.get("/api/datasheets/rust-pilgrims:nope").expectStatus(404);
        user.get("/api/factions/nope/datasheets").expectStatus(404);
    }

    @Test
    @Order(4)
    void importIsAdminOnlyAndValidatesUploads() {
        TestClient user = registeredUser("sneaky");
        user.multipart("/api/admin/imports/battlescribe", "file", "x.zip", Fixtures.battleScribeZip()).expectStatus(403);
        TestClient admin = adminClient();
        assertThat(admin.multipart("/api/admin/imports/battlescribe", "file", "x.zip", "not a zip".getBytes())
                .expectStatus(400).errorCode()).isEqualTo("BATTLESCRIBE_LAYOUT");
        byte[] noGst = Fixtures.zip("battlescribe", java.util.List.of("Imperium - Rust Pilgrims.cat"));
        assertThat(admin.multipart("/api/admin/imports/battlescribe", "file", "x.zip", noGst).expectStatus(400).errorCode())
                .isEqualTo("BATTLESCRIBE_LAYOUT");
    }
}
