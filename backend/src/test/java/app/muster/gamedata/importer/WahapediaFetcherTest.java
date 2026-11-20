package app.muster.gamedata.importer;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.gamedata.importer.wahapedia.WahapediaFetcher;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class WahapediaFetcherTest {

    @TempDir
    Path dir;

    HttpServer server;
    final List<String> requests = new CopyOnWriteArrayList<>();
    final List<Long> times = new CopyOnWriteArrayList<>();
    final List<String> userAgents = new CopyOnWriteArrayList<>();

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            requests.add(path + (ex.getRequestHeaders().containsKey("If-None-Match") ? "?conditional" : ""));
            times.add(System.nanoTime());
            userAgents.add(ex.getRequestHeaders().getFirst("User-Agent"));
            byte[] body;
            if (path.equals("/robots.txt")) {
                body = "User-agent: *\nDisallow: /wh_/\nDisallow: /wh/Abilities.csv\n".getBytes();
            } else if (ex.getRequestHeaders().containsKey("If-None-Match")) {
                ex.sendResponseHeaders(304, -1);
                ex.close();
                return;
            } else {
                body = ("id|name|\n1|" + path + "|\n").getBytes();
                ex.getResponseHeaders().add("ETag", "\"v1\"");
            }
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    WahapediaFetcher fetcher(Duration interval) {
        return new WahapediaFetcher(dir.toString(), "http://127.0.0.1:" + server.getAddress().getPort() + "/wh/", "MusterTest/1.0", interval);
    }

    @Test
    void downloadsOnceThenServesFromCacheAndHonoursRobots() throws IOException {
        var f = fetcher(Duration.ofMillis(30));
        var first = f.fetch(false);
        assertThat(requests).contains("/robots.txt", "/wh/Datasheets.csv", "/wh/the-rules/core-rules/");
        assertThat(requests).doesNotContain("/wh/Abilities.csv");
        assertThat(first.files()).containsKey("Datasheets.csv").doesNotContainKey("Abilities.csv");
        assertThat(Files.exists(dir.resolve("wahapedia-cache").resolve("Datasheets.csv"))).isTrue();
        assertThat(userAgents).allMatch("MusterTest/1.0"::equals);
        for (int i = 1; i < times.size(); i++) {
            assertThat(times.get(i) - times.get(i - 1)).isGreaterThanOrEqualTo(Duration.ofMillis(25).toNanos());
        }

        int before = requests.size();
        var second = f.fetch(false);
        assertThat(requests).hasSize(before);
        assertThat(second.log()).noneMatch(WahapediaFetcher.FetchedFile::downloaded);
        assertThat(second.files().get("Datasheets.csv")).isEqualTo(first.files().get("Datasheets.csv"));

        f.fetch(true);
        assertThat(requests.subList(before, requests.size())).contains("/wh/Datasheets.csv?conditional");
    }

    @Test
    void cachedReadsWithoutNetwork() {
        fetcher(Duration.ZERO).fetch(false);
        server.stop(0);
        assertThat(fetcher(Duration.ZERO).cached()).containsKey("Factions.csv");
    }
}
