package app.muster.realdata;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.support.IntegrationTest;
import app.muster.support.TestClient;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Manual acceptance check for M4 against the real Wahapedia cache in ./data-sources (never committed):
 * builds a 2000 point Death Guard list through the API only. Run with
 * {@code ./mvnw verify -Dit.test=RealDataRosterIT -Dmuster.realData=true -Dtest=NONE -Dsurefire.failIfNoSpecifiedTests=false}.
 */
@EnabledIfSystemProperty(named = "muster.realData", matches = "true")
class RealDataRosterIT extends IntegrationTest {

    static byte[] cacheZip() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes); var files = Files.list(Path.of("..", "data-sources", "wahapedia-cache"))) {
            for (Path p : files.toList()) {
                String n = p.getFileName().toString();
                if (!n.endsWith(".csv") && !n.endsWith(".html")) continue;
                zip.putNextEntry(new ZipEntry(n));
                zip.write(Files.readAllBytes(p));
                zip.closeEntry();
            }
        }
        return bytes.toByteArray();
    }

    @Test
    void buildA2000PointDeathGuardList() throws Exception {
        TestClient admin = adminClient();
        long v = admin.multipart("/api/admin/imports/wahapedia", "file", "waha.zip", cacheZip()).expectStatus(201).json().get("versionId").asLong();
        admin.post("/api/admin/data-versions/" + v + "/activate", "").expectStatus(200);

        TestClient user = registeredUser("dg");
        String sizeKey = null;
        for (JsonNode b : user.get("/api/battle-sizes").json()) if (b.get("pointsLimit").asInt() == 2000) sizeKey = b.get("key").asText();
        assertThat(sizeKey).as("a 2000 point battle size in the data").isNotNull();
        JsonNode r = user.post("/api/rosters", "{\"name\":\"Plague Host\",\"factionKey\":\"death-guard\",\"battleSizeKey\":\"" + sizeKey + "\"}")
                .expectStatus(201).json();
        long id = r.get("id").asLong();

        JsonNode dets = user.get("/api/factions/death-guard/detachments").json();
        JsonNode det = dets.get(0);
        for (JsonNode d : dets) if (d.at("/detachment/dpCost").asInt(9) <= 3 && d.get("enhancements").size() > 0) { det = d; break; }
        String detKey = det.at("/detachment/key").asText();
        r = user.put("/api/rosters/" + id + "/detachments", "{\"detachmentKeys\":[\"" + detKey + "\"]}").expectStatus(200).json();
        if (det.at("/detachment/forceDispositions").size() > 0) {
            String fd = "fd:" + det.at("/detachment/forceDispositions/0").asText().toLowerCase().replaceAll("[^a-z0-9]+", "-");
            r = user.patch("/api/rosters/" + id + "/config", "{\"forceDisposition\":\"" + fd + "\"}").expectStatus(200).json();
        }

        JsonNode sheets = user.get("/api/factions/death-guard/datasheets").json();
        List<JsonNode> pool = new ArrayList<>();
        JsonNode warlord = null;
        for (JsonNode s : sheets) {
            if (s.get("legends").asBoolean() || s.get("sizes").isEmpty() || !s.at("/sizes/0/points").isInt()) continue;
            String role = s.path("role").asText("").toLowerCase();
            if (role.contains("epic hero")) continue;
            if (warlord == null && role.contains("character")) warlord = s;
            else if (!role.contains("character") && !role.contains("fortification")) pool.add(s);
        }
        assertThat(warlord).isNotNull();
        r = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"" + warlord.get("key").asText() + "\"}").expectStatus(201).json();
        long warlordEntry = r.at("/entries/0/id").asLong();
        String enh = null;
        for (JsonNode e : det.get("enhancements")) {
            boolean listed = e.get("eligibleDatasheets").size() == 0;
            for (JsonNode k : e.get("eligibleDatasheets")) if (k.asText().equals(warlord.get("key").asText())) listed = true;
            if (listed && !e.path("upgrade").asBoolean() && e.get("requiredKeywords").size() == 0) { enh = e.get("key").asText(); break; }
        }
        String patch = enh == null ? "{\"warlord\":true}" : "{\"warlord\":true,\"enhancementKey\":\"" + enh + "\"}";
        r = user.patch("/api/rosters/" + id + "/entries/" + warlordEntry, patch).expectStatus(200).json();

        Map<String, Integer> copies = new HashMap<>();
        boolean added = true;
        while (added) {
            added = false;
            for (JsonNode s : pool) {
                int points = r.at("/totals/points").asInt();
                int cost = s.at("/sizes/0/points").asInt();
                if (points + cost > 2000 || copies.getOrDefault(s.get("key").asText(), 0) >= 2) continue;
                JsonNode next = user.post("/api/rosters/" + id + "/entries", "{\"datasheetKey\":\"" + s.get("key").asText() + "\"}").expectStatus(201).json();
                boolean overLimit = false;
                for (JsonNode vio : next.get("violations")) if (vio.get("severity").asText().equals("ERROR") && !vio.get("code").asText().equals("FORCE_DISPOSITION")) overLimit |= vio.get("code").asText().equals("DATASHEET_LIMIT") || vio.get("code").asText().equals("POINTS_LIMIT");
                long newId = -1;
                for (JsonNode e : next.get("entries")) newId = Math.max(newId, e.get("id").asLong());
                if (overLimit) {
                    r = user.delete("/api/rosters/" + id + "/entries/" + newId).expectStatus(200).json();
                    continue;
                }
                r = next;
                copies.merge(s.get("key").asText(), 1, Integer::sum);
                added = true;
            }
        }
        System.out.println("REAL DG LIST points=" + r.at("/totals/points").asInt() + " units=" + r.get("entries").size() + " dp=" + r.at("/totals/dp").asInt());
        r.get("violations").forEach(x -> System.out.println("REAL DG VIOLATION " + x));
        List<String> errors = new ArrayList<>();
        r.get("violations").forEach(x -> { if (x.get("severity").asText().equals("ERROR")) errors.add(x.get("code").asText() + ": " + x.get("message").asText()); });
        assertThat(errors).isEmpty();
        assertThat(r.at("/totals/points").asInt()).isBetween(1800, 2000);
        assertThat(r.at("/totals/legal").asBoolean()).isTrue();
    }
}
