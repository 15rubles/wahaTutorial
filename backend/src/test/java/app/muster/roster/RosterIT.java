package app.muster.roster;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.support.IntegrationTest;
import app.muster.support.TestClient;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class RosterIT extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void data() {
        jdbc.update("DELETE FROM manual_override");
        importAllAndActivate(adminClient());
    }

    static List<String> codes(JsonNode view) {
        List<String> out = new ArrayList<>();
        view.get("violations").forEach(v -> out.add(v.get("code").asText()));
        return out;
    }

    static long entryId(JsonNode view, String datasheetKey) {
        long id = -1;
        for (JsonNode e : view.get("entries")) if (e.get("datasheetKey").asText().equals(datasheetKey)) id = e.get("id").asLong();
        return id;
    }

    @Test
    void buildALegalListThroughTheApi() {
        TestClient user = registeredUser("builder");
        JsonNode r = user.post("/api/rosters", """
                {"name":"Iron Pilgrims","factionKey":"rust-pilgrims","battleSizeKey":"battle-size:grand-clash"}
                """).expectStatus(201).json();
        long id = r.get("id").asLong();
        assertThat(r.at("/totals/points").asInt()).isZero();
        assertThat(r.at("/totals/pointsLimit").asInt()).isEqualTo(2000);
        assertThat(codes(r)).contains("NO_DETACHMENT");

        r = user.put("/api/rosters/" + id + "/detachments", "{\"detachmentKeys\":[\"rust-pilgrims:det:pilgrimage-of-iron\"]}").expectStatus(200).json();
        assertThat(r.at("/totals/dp").asInt()).isEqualTo(1);
        assertThat(r.at("/totals/dpBudget").asInt()).isEqualTo(3);

        r = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:rust-prophet\"}").expectStatus(201).json();
        long prophet = entryId(r, "rust-pilgrims:rust-prophet");
        r = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:pilgrim-warband\",\"sizeKey\":\"rust-pilgrims:pilgrim-warband:size:20\"}")
                .expectStatus(201).json();
        long warband = entryId(r, "rust-pilgrims:pilgrim-warband");
        assertThat(codes(r)).contains("NO_WARLORD");

        r = user.patch("/api/rosters/" + id + "/entries/" + prophet,
                "{\"warlord\":true,\"enhancementKey\":\"rust-pilgrims:det:pilgrimage-of-iron:enh:relic-of-rust\",\"attachedTo\":" + warband + "}")
                .expectStatus(200).json();
        r = user.patch("/api/rosters/" + id + "/config",
                "{\"forceDisposition\":\"fd:hold-the-line\",\"name\":\"Iron Pilgrims II\"}").expectStatus(200).json();
        assertThat(r.get("name").asText()).isEqualTo("Iron Pilgrims II");
        assertThat(r.at("/totals/legal").asBoolean()).as("violations %s", r.get("violations")).isTrue();
        // MFM points: prophet 80 + warband 20 models 190 + relic 30 (MFM)
        assertThat(r.at("/totals/points").asInt()).isEqualTo(300);
        JsonNode p = null;
        for (JsonNode e : r.get("entries")) if (e.get("id").asLong() == prophet) p = e;
        assertThat(p.get("warlord").asBoolean()).isTrue();
        assertThat(p.get("enhancementName").asText()).isEqualTo("Relic of Rust");
        assertThat(p.get("attachedTo").asLong()).isEqualTo(warband);

        // The list shows up in "my lists" with its cached totals.
        JsonNode list = user.get("/api/rosters").json();
        assertThat(list.get(0).get("points").asInt()).isEqualTo(300);
        assertThat(list.get(0).get("legal").asBoolean()).isTrue();
        assertThat(list.get(0).get("factionName").asText()).isEqualTo("Rust Pilgrims");
    }

    @Test
    void mutationsAlwaysReturnTotalsAndViolations() {
        TestClient user = registeredUser("mut");
        long id = user.post("/api/rosters", "{\"name\":\"M\",\"factionKey\":\"rust-pilgrims\"}").expectStatus(201).json().get("id").asLong();
        JsonNode r = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:scrap-walker\"}").expectStatus(201).json();
        assertThat(codes(r)).contains("LEGENDS");
        r = user.patch("/api/rosters/" + id + "/config", "{\"flags\":{\"legends\":true,\"unalignedForces\":false,\"unalignedFortifications\":false}}")
                .expectStatus(200).json();
        assertThat(codes(r)).doesNotContain("LEGENDS");
        long walker = entryId(r, "rust-pilgrims:scrap-walker");
        r = user.delete("/api/rosters/" + id + "/entries/" + walker).expectStatus(200).json();
        assertThat(r.get("entries")).isEmpty();
        assertThat(r.has("totals")).isTrue();
        assertThat(r.has("violations")).isTrue();
    }

    @Test
    void inputIsValidatedAgainstTheData() {
        TestClient user = registeredUser("val");
        assertThat(user.post("/api/rosters", "{\"name\":\"\",\"factionKey\":\"rust-pilgrims\"}").expectStatus(400).errorCode()).isEqualTo("VALIDATION_FAILED");
        assertThat(user.post("/api/rosters", "{\"name\":\"x\",\"factionKey\":\"nope\"}").expectStatus(400).errorCode()).isEqualTo("UNKNOWN_FACTION");
        long id = user.post("/api/rosters", "{\"name\":\"V\",\"factionKey\":\"rust-pilgrims\"}").expectStatus(201).json().get("id").asLong();
        assertThat(user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"other-host:thing\"}").expectStatus(400).errorCode())
                .isEqualTo("UNKNOWN_DATASHEET");
        assertThat(user.put("/api/rosters/" + id + "/detachments", "{\"detachmentKeys\":[\"x:det:y\"]}").expectStatus(400).errorCode())
                .isEqualTo("UNKNOWN_DETACHMENT");
        JsonNode r = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:rust-prophet\"}").expectStatus(201).json();
        long e = entryId(r, "rust-pilgrims:rust-prophet");
        assertThat(user.patch("/api/rosters/" + id + "/entries/" + e, "{\"sizeKey\":\"nope\"}").expectStatus(400).errorCode()).isEqualTo("UNKNOWN_SIZE");
        assertThat(user.patch("/api/rosters/" + id + "/entries/" + e, "{\"attachedTo\":" + e + "}").expectStatus(400).errorCode()).isEqualTo("ATTACH_SELF");
        assertThat(user.patch("/api/rosters/" + id + "/entries/" + e, "{\"wargear\":[{\"option\":\"x\",\"choice\":\"y\",\"count\":1}]}")
                .expectStatus(400).errorCode()).isEqualTo("UNKNOWN_WARGEAR");
        assertThat(user.patch("/api/rosters/" + id + "/entries/" + e, "{\"sortOrder\":-1}").expectStatus(400).errorCode()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void usersOnlySeeTheirOwnRosters() {
        TestClient a = registeredUser("own-a");
        TestClient b = registeredUser("own-b");
        long id = a.post("/api/rosters", "{\"name\":\"Mine\",\"factionKey\":\"rust-pilgrims\"}").expectStatus(201).json().get("id").asLong();
        b.get("/api/rosters/" + id).expectStatus(404);
        b.patch("/api/rosters/" + id + "/config", "{\"name\":\"stolen\"}").expectStatus(404);
        b.delete("/api/rosters/" + id).expectStatus(404);
        assertThat(b.get("/api/rosters").json()).isEmpty();
    }

    @Test
    void duplicateAndDelete() {
        TestClient user = registeredUser("dup");
        long id = user.post("/api/rosters", "{\"name\":\"Orig\",\"factionKey\":\"rust-pilgrims\"}").expectStatus(201).json().get("id").asLong();
        JsonNode r = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:pilgrim-warband\"}").json();
        long wb = entryId(r, "rust-pilgrims:pilgrim-warband");
        r = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:rust-prophet\"}").json();
        long pr = entryId(r, "rust-pilgrims:rust-prophet");
        user.patch("/api/rosters/" + id + "/entries/" + pr, "{\"attachedTo\":" + wb + "}").expectStatus(200);

        JsonNode copy = user.post("/api/rosters/" + id + "/duplicate", "").expectStatus(201).json();
        assertThat(copy.get("name").asText()).isEqualTo("Orig (copy)");
        assertThat(copy.get("id").asLong()).isNotEqualTo(id);
        long copyWb = entryId(copy, "rust-pilgrims:pilgrim-warband");
        long copyPr = entryId(copy, "rust-pilgrims:rust-prophet");
        assertThat(copyWb).isNotEqualTo(wb);
        JsonNode cp = null;
        for (JsonNode e : copy.get("entries")) if (e.get("id").asLong() == copyPr) cp = e;
        assertThat(cp.get("attachedTo").asLong()).isEqualTo(copyWb);

        user.delete("/api/rosters/" + id).expectStatus(204);
        user.get("/api/rosters/" + id).expectStatus(404);
        assertThat(user.get("/api/rosters").json()).hasSize(1);
    }

    @Test
    void outdatedRostersCanBeUpdatedToCurrentData() {
        TestClient user = registeredUser("upd");
        long id = user.post("/api/rosters", "{\"name\":\"Old\",\"factionKey\":\"rust-pilgrims\"}").expectStatus(201).json().get("id").asLong();
        user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"rust-pilgrims:rust-prophet\"}").expectStatus(201);
        JsonNode before = user.get("/api/rosters/" + id).json();
        assertThat(before.at("/version/outdated").asBoolean()).isFalse();
        int oldPoints = before.at("/totals/points").asInt();

        // A new MFM with a different price, imported and activated.
        TestClient admin = adminClient();
        java.util.List<String> lines = new java.util.ArrayList<>(app.muster.support.Fixtures.MFM_LINES);
        lines.replaceAll(l -> l.startsWith("Rust Prophet") ? "Rust Prophet .......... 1 model .......... 99 pts" : l);
        long v = admin.multipart("/api/admin/imports/mfm", "file", "mfm2.pdf", app.muster.support.Fixtures.mfmPdf(lines))
                .expectStatus(201).json().get("versionId").asLong();
        admin.post("/api/admin/data-versions/" + v + "/activate", "").expectStatus(200);

        JsonNode now = user.get("/api/rosters/" + id).json();
        assertThat(now.at("/version/outdated").asBoolean()).isTrue();
        // The list still uses the data it was built on until the user updates it.
        assertThat(now.at("/totals/points").asInt()).isEqualTo(oldPoints);
        JsonNode preview = user.get("/api/rosters/" + id + "/data-update").expectStatus(200).json();
        assertThat(preview.at("/changes/0/before").asInt()).isEqualTo(oldPoints);
        assertThat(preview.at("/changes/0/after").asInt()).isEqualTo(99);
        JsonNode updated = user.post("/api/rosters/" + id + "/data-update", "").expectStatus(200).json();
        assertThat(updated.at("/version/outdated").asBoolean()).isFalse();
        assertThat(updated.at("/totals/points").asInt()).isEqualTo(99);
    }

    @Test
    void prefs() {
        TestClient user = registeredUser("prefs");
        assertThat(user.get("/api/me/prefs").expectStatus(200).json().isObject()).isTrue();
        user.put("/api/me/prefs", "{\"panes\":[22,50,28],\"lastRosterId\":5}").expectStatus(200);
        assertThat(user.get("/api/me/prefs").json().at("/panes/1").asInt()).isEqualTo(50);
        assertThat(user.put("/api/me/prefs", "[1,2]").expectStatus(400).errorCode()).isEqualTo("BAD_PREFS");
    }
}
