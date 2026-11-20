package app.muster.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.CookieManager;
import java.net.HttpCookie;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;

/** Minimal browser-like HTTP client: keeps cookies and echoes the CSRF cookie as a header. */
public class TestClient {

    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    private final String base;
    private final CookieManager cookies = new CookieManager();
    private final HttpClient http;
    private boolean sendCsrf = true;

    public TestClient(String base) {
        this.base = base;
        this.http = HttpClient.newBuilder().cookieHandler(cookies).build();
    }

    public TestClient withoutCsrf() {
        this.sendCsrf = false;
        return this;
    }

    public Response get(String path) {
        return send(HttpRequest.newBuilder(URI.create(base + path)).GET());
    }

    public Response post(String path, String body) {
        return send(withJson(path, body).POST(HttpRequest.BodyPublishers.ofString(body)));
    }

    public Response put(String path, String body) {
        return send(withJson(path, body).PUT(HttpRequest.BodyPublishers.ofString(body)));
    }

    public Response patch(String path, String body) {
        return send(withJson(path, body).method("PATCH", HttpRequest.BodyPublishers.ofString(body)));
    }

    public Response delete(String path) {
        return send(HttpRequest.newBuilder(URI.create(base + path)).DELETE());
    }

    public Response multipart(String path, String fieldName, String fileName, byte[] content) {
        String boundary = "----muster" + System.nanoTime();
        byte[] head = ("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + fieldName
                        + "\"; filename=\"" + fileName + "\"\r\nContent-Type: application/octet-stream\r\n\r\n")
                .getBytes();
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes();
        byte[] all = new byte[head.length + content.length + tail.length];
        System.arraycopy(head, 0, all, 0, head.length);
        System.arraycopy(content, 0, all, head.length, content.length);
        System.arraycopy(tail, 0, all, head.length + content.length, tail.length);
        return send(HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(all)));
    }

    public Response login(String username, String password) {
        return post("/api/auth/login", "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password));
    }

    public Optional<String> cookie(String name) {
        return cookies.getCookieStore().getCookies().stream()
                .filter(c -> c.getName().equals(name))
                .map(HttpCookie::getValue)
                .findFirst();
    }

    private HttpRequest.Builder withJson(String path, String body) {
        return HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", "application/json");
    }

    private Response send(HttpRequest.Builder req) {
        try {
            if (sendCsrf) {
                if (cookie("XSRF-TOKEN").isEmpty()) {
                    http.send(HttpRequest.newBuilder(URI.create(base + "/api/auth/csrf")).GET().build(),
                            HttpResponse.BodyHandlers.discarding());
                }
                cookie("XSRF-TOKEN").ifPresent(t -> req.header("X-XSRF-TOKEN", t));
            }
            req.header("Accept", "application/json");
            HttpResponse<byte[]> res = http.send(req.build(), HttpResponse.BodyHandlers.ofByteArray());
            return new Response(res.statusCode(), res.body(), res);
        } catch (IOException e) {
            throw new RuntimeException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        }
    }

    public record Response(int status, byte[] body, HttpResponse<byte[]> raw) {

        public Response expectStatus(int expected) {
            assertThat(status).as("HTTP status, body: %s", text()).isEqualTo(expected);
            return this;
        }

        public String text() {
            return new String(body);
        }

        public JsonNode json() {
            try {
                return JSON.readTree(body);
            } catch (IOException e) {
                throw new RuntimeException("Not JSON: " + text(), e);
            }
        }

        public String errorCode() {
            return json().path("code").asText();
        }
    }
}
