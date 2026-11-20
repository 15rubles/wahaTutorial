package app.muster.gamedata.importer.wahapedia;

import app.muster.common.ApiException;
import app.muster.gamedata.build.GameJson;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Downloads the Wahapedia export into the local cache, politely: a descriptive User-Agent, at most one
 * request per second, robots.txt respected, and a cached file is never fetched again unless the admin
 * asks for a refresh (then with conditional headers, so unchanged files cost no download). Only ever
 * runs when an admin triggers it.
 */
@Component
public class WahapediaFetcher {

    private static final Logger log = LoggerFactory.getLogger(WahapediaFetcher.class);
    private static final String META = ".meta.json";

    public record FetchedFile(String name, boolean downloaded, Instant fetchedAt) {}

    public record Result(Map<String, byte[]> files, List<FetchedFile> log) {}

    private record Meta(Map<String, Entry> files) {
        record Entry(Instant fetchedAt, Optional<String> etag, Optional<String> lastModified) {}
    }

    private final Path cacheDir;
    private final String baseUrl;
    private final String userAgent;
    private final Duration minInterval;
    private final HttpClient http;
    private Instant lastRequest = Instant.EPOCH;

    public WahapediaFetcher(
            @Value("${muster.data-sources-dir:./data-sources}") String dataSources,
            @Value("${muster.wahapedia.base-url:https://wahapedia.ru/wh40k11ed/}") String baseUrl,
            @Value("${muster.wahapedia.user-agent:Muster/1.0 (private non-commercial army builder)}") String userAgent,
            @Value("${muster.wahapedia.min-interval:1s}") Duration minInterval) {
        this.cacheDir = Path.of(dataSources, "wahapedia-cache");
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
        this.userAgent = userAgent;
        this.minInterval = minInterval;
        this.http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).connectTimeout(Duration.ofSeconds(20)).build();
    }

    public synchronized Result fetch(boolean refresh) {
        try {
            Files.createDirectories(cacheDir);
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "CACHE_UNAVAILABLE", "Cannot create " + cacheDir);
        }
        Meta meta = readMeta();
        Map<String, Meta.Entry> entries = new LinkedHashMap<>(meta.files());
        List<String> disallowed = refresh || !Files.exists(cacheDir.resolve("robots.txt")) ? robots(entries) : cachedRobots();
        Map<String, byte[]> files = new LinkedHashMap<>();
        List<FetchedFile> fetched = new ArrayList<>();
        List<String> names = new ArrayList<>();
        for (String csv : WahapediaImporter.CSV_FILES) names.add(csv + ".csv");
        names.add(WahapediaImporter.CORE_RULES_FILE);
        for (String name : names) {
            String path = name.equals(WahapediaImporter.CORE_RULES_FILE) ? "the-rules/core-rules/" : name;
            URI uri = URI.create(baseUrl + path);
            if (isDisallowed(uri.getPath(), disallowed)) {
                log.warn("robots.txt disallows {}, skipped", uri);
                continue;
            }
            Path file = cacheDir.resolve(name);
            Meta.Entry entry = entries.get(name);
            boolean cached = Files.exists(file) && entry != null;
            if (cached && !refresh) {
                files.put(name, read(file));
                fetched.add(new FetchedFile(name, false, entry.fetchedAt()));
                continue;
            }
            HttpRequest.Builder req = request(uri);
            if (cached) {
                entry.etag().ifPresent(v -> req.header("If-None-Match", v));
                entry.lastModified().ifPresent(v -> req.header("If-Modified-Since", v));
            }
            HttpResponse<byte[]> res = send(req.build());
            if (res.statusCode() == 304 && cached) {
                files.put(name, read(file));
                fetched.add(new FetchedFile(name, false, entry.fetchedAt()));
                continue;
            }
            if (res.statusCode() != 200) {
                if (cached) {
                    files.put(name, read(file));
                    fetched.add(new FetchedFile(name, false, entry.fetchedAt()));
                    log.warn("Wahapedia answered {} for {}, using the cached copy", res.statusCode(), name);
                    continue;
                }
                throw ApiException.badRequest("WAHAPEDIA_FETCH", "Wahapedia answered " + res.statusCode() + " for " + name);
            }
            write(file, res.body());
            Instant now = Instant.now();
            entries.put(name, new Meta.Entry(now, res.headers().firstValue("ETag"), res.headers().firstValue("Last-Modified")));
            files.put(name, res.body());
            fetched.add(new FetchedFile(name, true, now));
        }
        writeMeta(new Meta(entries));
        return new Result(files, fetched);
    }

    /** Files already in the cache, without any network access. */
    public Map<String, byte[]> cached() {
        Map<String, byte[]> files = new LinkedHashMap<>();
        if (!Files.isDirectory(cacheDir)) return files;
        try (var s = Files.list(cacheDir)) {
            for (Path p : s.toList()) {
                String n = p.getFileName().toString();
                if (n.endsWith(".csv") || n.endsWith(".html")) files.put(n, read(p));
            }
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "CACHE_UNAVAILABLE", "Cannot read " + cacheDir);
        }
        return files;
    }

    private List<String> robots(Map<String, Meta.Entry> entries) {
        URI uri = URI.create(baseUrl).resolve("/robots.txt");
        HttpResponse<byte[]> res = send(request(uri).build());
        if (res.statusCode() != 200) return List.of();
        write(cacheDir.resolve("robots.txt"), res.body());
        entries.put("robots.txt", new Meta.Entry(Instant.now(), Optional.empty(), Optional.empty()));
        return parseRobots(new String(res.body()));
    }

    private List<String> cachedRobots() {
        return parseRobots(new String(read(cacheDir.resolve("robots.txt"))));
    }

    /** Disallow rules that apply to every user agent ("User-agent: *" groups). */
    static List<String> parseRobots(String txt) {
        List<String> out = new ArrayList<>();
        boolean applies = false;
        boolean lastWasAgent = false;
        for (String raw : txt.split("\n")) {
            String line = raw.replaceAll("#.*", "").trim();
            if (line.isEmpty()) continue;
            String lower = line.toLowerCase(Locale.ROOT);
            if (lower.startsWith("user-agent:")) {
                String agent = line.substring(11).trim();
                applies = (lastWasAgent && applies) || agent.equals("*");
                lastWasAgent = true;
                continue;
            }
            lastWasAgent = false;
            if (applies && lower.startsWith("disallow:")) {
                String path = line.substring(9).trim();
                if (!path.isEmpty()) out.add(path);
            }
        }
        return out;
    }

    static boolean isDisallowed(String path, List<String> rules) {
        for (String rule : rules) {
            String prefix = rule.replace("*", "");
            if (!prefix.isEmpty() && path.startsWith(prefix)) return true;
        }
        return false;
    }

    private HttpRequest.Builder request(URI uri) {
        return HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(60)).header("User-Agent", userAgent).GET();
    }

    private HttpResponse<byte[]> send(HttpRequest req) {
        IOException last = null;
        for (int attempt = 0; attempt < 3; attempt++) {
            pace();
            try {
                return http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            } catch (IOException e) {
                last = e;
                log.warn("Wahapedia request {} failed (attempt {}): {}", req.uri(), attempt + 1, e.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw ApiException.badRequest("WAHAPEDIA_FETCH", "Interrupted");
            }
        }
        throw ApiException.badRequest("WAHAPEDIA_FETCH", "Could not reach Wahapedia: " + (last == null ? "" : last.getMessage()));
    }

    private void pace() {
        Duration since = Duration.between(lastRequest, Instant.now());
        if (since.compareTo(minInterval) < 0) {
            try {
                Thread.sleep(minInterval.minus(since).toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastRequest = Instant.now();
    }

    private Meta readMeta() {
        Path p = cacheDir.resolve(META);
        if (!Files.exists(p)) return new Meta(Map.of());
        try {
            return GameJson.MAPPER.readValue(p.toFile(), Meta.class);
        } catch (IOException e) {
            return new Meta(Map.of());
        }
    }

    private void writeMeta(Meta meta) {
        try {
            GameJson.MAPPER.writerWithDefaultPrettyPrinter().writeValue(cacheDir.resolve(META).toFile(), meta);
        } catch (IOException e) {
            log.warn("Could not write {}: {}", META, e.getMessage());
        }
    }

    private static byte[] read(Path p) {
        try {
            return Files.readAllBytes(p);
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "CACHE_UNAVAILABLE", "Cannot read " + p.getFileName());
        }
    }

    private static void write(Path p, byte[] bytes) {
        try {
            Files.write(p, bytes);
        } catch (IOException e) {
            throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "CACHE_UNAVAILABLE", "Cannot write " + p.getFileName());
        }
    }
}
