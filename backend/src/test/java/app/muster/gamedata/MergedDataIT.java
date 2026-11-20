package app.muster.gamedata;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.support.Fixtures;
import app.muster.support.IntegrationTest;
import app.muster.support.TestClient;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

class MergedDataIT extends IntegrationTest {

    /** Imports all three invented sources and activates the result. */
    public static long importAllAndActivate(TestClient admin) {
        admin.multipart("/api/admin/imports/battlescribe", "file", "bs.zip", Fixtures.battleScribeZip()).expectStatus(201);
        admin.multipart("/api/admin/imports/wahapedia", "file", "waha.zip", Fixtures.wahapediaZip()).expectStatus(201);
        long v = admin.multipart("/api/admin/imports/mfm", "file", "mfm.pdf", Fixtures.mfmPdf(Fixtures.MFM_LINES))
                .expectStatus(201).json().get("versionId").asLong();
        admin.post("/api/admin/data-versions/" + v + "/activate", "").expectStatus(200);
        return v;
    }

    @Test
    void mergesSourcesByPriorityAndReportsUnmatched() {
        TestClient admin = adminClient();
        long v = importAllAndActivate(admin);
        JsonNode report = admin.get("/api/admin/data-versions/" + v + "/report").json();
        assertThat(report.get("sourceImports").fieldNames()).toIterable().containsExactlyInAnyOrder("BATTLESCRIBE", "WAHAPEDIA", "MFM");
        boolean ghost = false;
        for (JsonNode i : report.get("issues")) {
            if (i.get("category").asText().equals("unmatched") && i.get("message").asText().contains("ghost-unit")) ghost = true;
        }
        assertThat(ghost).isTrue();

        TestClient user = registeredUser("merge");
        JsonNode warband = user.get("/api/datasheets/rust-pilgrims:pilgrim-warband").expectStatus(200).json();
        // Points: MFM (100) beats Wahapedia (95) beats BattleScribe (90); tiers still come from Wahapedia.
        JsonNode ten = null;
        for (JsonNode s : warband.get("sizes")) if (s.get("models").asInt() == 10) ten = s;
        assertThat(ten).isNotNull();
        assertThat(ten.get("points").asInt()).isEqualTo(100);
        assertThat(ten.get("tiers")).hasSize(2);
        // Wargear options: BattleScribe's constraints win over Wahapedia's text-only option.
        assertThat(warband.get("wargear")).hasSize(1);
        assertThat(warband.at("/wargear/0/perModels").asInt()).isEqualTo(10);
        // Role text from Wahapedia.
        assertThat(warband.at("/datasheet/role").asText()).isEqualTo("Battleline");

        JsonNode dets = user.get("/api/factions/rust-pilgrims/detachments").json();
        JsonNode iron = null;
        for (JsonNode d : dets) if (d.at("/detachment/name").asText().equals("Pilgrimage of Iron")) iron = d;
        assertThat(iron).isNotNull();
        assertThat(iron.at("/enhancements/0/points").asInt()).isIn(30); // MFM wins
        assertThat(iron.at("/detachment/forceDispositions/0").asText()).isEqualTo("Hold the Line");
        assertThat(iron.get("stratagems")).hasSize(1);

        JsonNode skirmish = null;
        for (JsonNode b : user.get("/api/battle-sizes").json()) if (b.get("key").asText().equals("battle-size:skirmish")) skirmish = b;
        assertThat(skirmish).isNotNull();
        assertThat(skirmish.at("/limits/maxCopiesBattleline").asInt()).isEqualTo(4);
        assertThat(skirmish.get("pointsLimit").asInt()).isEqualTo(500);
        assertThat(user.get("/api/force-dispositions").json().findValuesAsText("name")).contains("Hold the Line", "Push Forward");
    }

    @Test
    void overridesSurviveRebuildsAndShowProvenance() {
        TestClient admin = adminClient();
        importAllAndActivate(admin);
        String key = "rust-pilgrims:rust-prophet:size:1";
        admin.put("/api/admin/overrides", """
                [{"type":"UNIT_SIZE","key":"%s","field":"points","value":77,"note":"local fix"}]
                """.formatted(key)).expectStatus(200);

        JsonNode detail = admin.get("/api/admin/entities/UNIT_SIZE/" + key).expectStatus(200).json();
        assertThat(detail.at("/stored/entity/points").asInt()).isEqualTo(77);
        assertThat(detail.at("/stored/provenance/points").asText()).isEqualTo("MANUAL");
        assertThat(detail.at("/overrides/0/note").asText()).isEqualTo("local fix");

        // A fresh import keeps the fix.
        long v2 = admin.multipart("/api/admin/imports/wahapedia", "file", "waha.zip", Fixtures.wahapediaZip()).expectStatus(201)
                .json().get("versionId").asLong();
        admin.post("/api/admin/data-versions/" + v2 + "/activate", "").expectStatus(200);
        JsonNode sheet = registeredUser("ov").get("/api/datasheets/rust-pilgrims:rust-prophet").json();
        assertThat(sheet.at("/sizes/0/points").asInt()).isEqualTo(77);

        // Bad overrides are refused before they are stored.
        assertThat(admin.put("/api/admin/overrides", """
                [{"type":"UNIT_SIZE","key":"%s","field":"points","value":"lots","note":""}]
                """.formatted(key)).expectStatus(400).errorCode()).isEqualTo("INVALID_OVERRIDE");
        assertThat(admin.put("/api/admin/overrides", """
                [{"type":"UNIT_SIZE","key":"%s","field":"key","value":"x","note":""}]
                """.formatted(key)).expectStatus(400).errorCode()).isEqualTo("BAD_FIELD");

        long id = -1;
        for (JsonNode o : admin.get("/api/admin/overrides").json()) if (o.get("key").asText().equals(key)) id = o.get("id").asLong();
        admin.delete("/api/admin/overrides/" + id).expectStatus(204);
        JsonNode after = admin.get("/api/admin/entities/UNIT_SIZE/" + key).json();
        assertThat(after.at("/stored/entity/points").asInt()).isNotEqualTo(77);
    }

    @Test
    void wholeEntityOverrideCreatesData() {
        TestClient admin = adminClient();
        importAllAndActivate(admin);
        admin.put("/api/admin/overrides", """
                [{"type":"FORCE_DISPOSITION","key":"fd:hold-the-line","field":"text.plain","value":"Invented text for a test.","note":""},
                 {"type":"BATTLE_SIZE","key":"battle-size:tiny","field":"*","value":{"name":"Tiny","pointsLimit":250,"dpBudget":1,"limits":{}},"note":"test size"}]
                """).expectStatus(200);
        TestClient user = registeredUser("whole");
        JsonNode fds = user.get("/api/force-dispositions").json();
        boolean found = false;
        for (JsonNode f : fds) if (f.get("key").asText().equals("fd:hold-the-line") && f.at("/text/plain").asText().startsWith("Invented")) found = true;
        assertThat(found).isTrue();
        assertThat(user.get("/api/battle-sizes").json().findValuesAsText("name")).contains("Tiny");
    }

    @Test
    void phaseTagReviewAndConfirm() {
        TestClient admin = adminClient();
        importAllAndActivate(admin);
        JsonNode page = admin.get("/api/admin/review/phase-tags?faction=rust-pilgrims&state=inferred").expectStatus(200).json();
        assertThat(page.get("total").asInt()).isGreaterThan(0);
        JsonNode first = page.at("/items/0");
        assertThat(first.at("/tags/inferred").asBoolean()).isTrue();

        admin.post("/api/admin/review/phase-tags/confirm", """
                [{"type":"%s","key":"%s","tags":{"phases":["FIGHT"],"timing":"EITHER_TURN","inferred":false,"confirmed":true}}]
                """.formatted(first.get("type").asText(), first.get("key").asText())).expectStatus(200);
        JsonNode after = admin.get("/api/admin/review/phase-tags?faction=rust-pilgrims&state=inferred").json();
        assertThat(after.get("total").asInt()).isEqualTo(page.get("total").asInt() - 1);
        JsonNode e = admin.get("/api/admin/entities/" + first.get("type").asText() + "/" + first.get("key").asText()).json();
        assertThat(e.at("/stored/entity/tags/confirmed").asBoolean()).isTrue();
        assertThat(e.at("/stored/entity/tags/phases/0").asText()).isEqualTo("FIGHT");
    }

    @Test
    void entityBrowser() {
        TestClient admin = adminClient();
        importAllAndActivate(admin);
        JsonNode list = admin.get("/api/admin/entities?type=DATASHEET&faction=rust-pilgrims&q=prophet").expectStatus(200).json();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).get("key").asText()).isEqualTo("rust-pilgrims:rust-prophet");
        admin.get("/api/admin/entities/DATASHEET/rust-pilgrims:nope").expectStatus(404);
    }
}
