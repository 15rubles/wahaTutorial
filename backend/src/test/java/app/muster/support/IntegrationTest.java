package app.muster.support;

import app.muster.TestcontainersConfig;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

/** Base class: one shared Spring context + Postgres container for all integration tests. */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "COOKIE_SECURE=false",
            "muster.auth.admin.username=admin",
            "muster.auth.admin.password=admin-password-123",
            "muster.auth.admin.email=admin@example.test"
        })
@Import(TestcontainersConfig.class)
public abstract class IntegrationTest {

    public static final String ADMIN_USER = "admin";
    public static final String ADMIN_PASSWORD = "admin-password-123";

    @LocalServerPort
    protected int port;

    /** A fresh browser-like client with its own cookie jar. */
    protected TestClient newClient() {
        return new TestClient("http://localhost:" + port);
    }

    protected TestClient adminClient() {
        TestClient c = newClient();
        c.login(ADMIN_USER, ADMIN_PASSWORD).expectStatus(200);
        return c;
    }

    private static int counter = 0;

    /** Registers a new user with a fresh invite and returns their signed-in client. */
    protected TestClient registeredUser(String prefix) {
        String code = adminClient().post("/api/admin/invites", "{}").expectStatus(201).json().get("code").asText();
        String name = prefix + (++counter) + System.nanoTime() % 100000;
        TestClient c = newClient();
        c.post("/api/auth/register", """
                {"username":"%s","email":"%s@example.test","password":"password-1234","inviteCode":"%s"}
                """.formatted(name, name, code)).expectStatus(201);
        return c;
    }
}
