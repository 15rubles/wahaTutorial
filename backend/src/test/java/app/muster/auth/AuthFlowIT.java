package app.muster.auth;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.support.IntegrationTest;
import app.muster.support.TestClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

class AuthFlowIT extends IntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    private String newInvite() {
        return adminClient().post("/api/admin/invites", "{\"validDays\":3}").expectStatus(201).json().get("code").asText();
    }

    private static String registerBody(String user, String invite) {
        return """
                {"username":"%s","email":"%s@example.test","password":"password-1234","inviteCode":"%s"}
                """.formatted(user, user, invite);
    }

    @Test
    void adminIsBootstrappedFromEnvironment() {
        var me = adminClient().get("/api/me").expectStatus(200).json();
        assertThat(me.get("username").asText()).isEqualTo(ADMIN_USER);
        assertThat(me.get("role").asText()).isEqualTo("ADMIN");
    }

    @Test
    void inviteThenRegisterThenMeThenLogout() {
        String invite = newInvite();
        TestClient friend = newClient();

        var created = friend.post("/api/auth/register", registerBody("friend_a", invite)).expectStatus(201).json();
        assertThat(created.get("role").asText()).isEqualTo("USER");
        assertThat(friend.cookie("MUSTER_SESSION")).isPresent();

        friend.get("/api/me").expectStatus(200);
        friend.post("/api/auth/logout", "").expectStatus(204);
        friend.get("/api/me").expectStatus(401);

        friend.login("FRIEND_A", "password-1234").expectStatus(200);
        friend.get("/api/me").expectStatus(200);
    }

    @Test
    void inviteIsSingleUse() {
        String invite = newInvite();
        newClient().post("/api/auth/register", registerBody("single_1", invite)).expectStatus(201);
        var second = newClient().post("/api/auth/register", registerBody("single_2", invite)).expectStatus(400);
        assertThat(second.errorCode()).isEqualTo("INVITE_USED");
    }

    @Test
    void inviteCodeIsMatchedLoosely() {
        String invite = newInvite().toLowerCase().replace("-", " ");
        newClient().post("/api/auth/register", registerBody("loose_1", invite)).expectStatus(201);
    }

    @Test
    void registrationRequiresAValidInvite() {
        var res = newClient().post("/api/auth/register", registerBody("nobody", "AAAA-BBBB-CCCC")).expectStatus(400);
        assertThat(res.errorCode()).isEqualTo("INVITE_INVALID");
    }

    @Test
    void expiredInviteIsRejected() {
        String invite = newInvite();
        jdbc.update("UPDATE invite_code SET expires_at = now() - interval '1 minute' WHERE code = ?", invite);
        var res = newClient().post("/api/auth/register", registerBody("late_1", invite)).expectStatus(400);
        assertThat(res.errorCode()).isEqualTo("INVITE_EXPIRED");
    }

    @Test
    void duplicateUsernameIsRejectedCaseInsensitively() {
        newClient().post("/api/auth/register", registerBody("dupe_x", newInvite())).expectStatus(201);
        var res = newClient()
                .post("/api/auth/register", """
                        {"username":"DUPE_X","email":"other@example.test","password":"password-1234","inviteCode":"%s"}
                        """.formatted(newInvite()))
                .expectStatus(409);
        assertThat(res.errorCode()).isEqualTo("USERNAME_TAKEN");
    }

    @Test
    void registrationValidatesFields() {
        var res = newClient()
                .post("/api/auth/register", """
                        {"username":"a b","email":"not-an-email","password":"short","inviteCode":"%s"}
                        """.formatted(newInvite()))
                .expectStatus(400)
                .json();
        assertThat(res.get("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(res.get("fieldErrors").findValuesAsText("field"))
                .containsExactlyInAnyOrder("username", "email", "password");
    }

    @Test
    void stateChangingRequestsNeedCsrfToken() {
        var res = newClient().withoutCsrf().login(ADMIN_USER, ADMIN_PASSWORD).expectStatus(403);
        assertThat(res.errorCode()).isEqualTo("CSRF_INVALID");
    }

    @Test
    void accountLocksAfterTenFailuresInARow() {
        newClient().post("/api/auth/register", registerBody("locky", newInvite())).expectStatus(201);
        TestClient c = newClient();
        for (int i = 0; i < 9; i++) {
            assertThat(c.login("locky", "wrong-password").expectStatus(401).errorCode()).isEqualTo("BAD_CREDENTIALS");
        }
        assertThat(c.login("locky", "wrong-password").expectStatus(423).errorCode()).isEqualTo("ACCOUNT_LOCKED");
        // Even the right password is refused while locked.
        assertThat(c.login("locky", "password-1234").expectStatus(423).errorCode()).isEqualTo("ACCOUNT_LOCKED");

        jdbc.update("UPDATE app_user SET locked_until = now() - interval '1 second' WHERE username = 'locky'");
        c.login("locky", "password-1234").expectStatus(200);
    }

    @Test
    void unknownUserGetsTheSameErrorAsWrongPassword() {
        assertThat(newClient().login("ghost", "whatever-123").expectStatus(401).errorCode()).isEqualTo("BAD_CREDENTIALS");
    }

    @Test
    void regularUsersCannotUseAdminEndpoints() {
        TestClient user = registeredUser("plain");
        assertThat(user.post("/api/admin/invites", "{}").expectStatus(403).errorCode()).isEqualTo("FORBIDDEN");
        assertThat(user.get("/api/admin/invites").expectStatus(403).errorCode()).isEqualTo("FORBIDDEN");
    }

    @Test
    void anonymousGets401InSharedShape() {
        assertThat(newClient().get("/api/rosters").expectStatus(401).errorCode()).isEqualTo("UNAUTHENTICATED");
    }

    @Test
    void adminListsInvitesWithStatus() {
        String invite = newInvite();
        var list = adminClient().get("/api/admin/invites").expectStatus(200).json();
        assertThat(list.findValuesAsText("code")).contains(invite);
    }

    @Test
    void eachUserSeesOnlyTheirOwnRosters() {
        TestClient a = registeredUser("ra");
        TestClient b = registeredUser("rb");
        long aId = a.get("/api/me").json().get("id").asLong();
        jdbc.update("INSERT INTO roster (owner_id, name) VALUES (?, 'A list')", aId);

        assertThat(a.get("/api/rosters").expectStatus(200).json().findValuesAsText("name")).containsExactly("A list");
        assertThat(b.get("/api/rosters").expectStatus(200).json()).isEmpty();
    }

    @Test
    void sessionIdChangesOnLogin() {
        TestClient c = newClient();
        c.get("/api/auth/csrf");
        c.post("/api/auth/login", "{\"username\":\"nope\",\"password\":\"nope-nope-nope\"}");
        var before = c.cookie("MUSTER_SESSION");
        c.login(ADMIN_USER, ADMIN_PASSWORD).expectStatus(200);
        assertThat(c.cookie("MUSTER_SESSION")).isPresent().isNotEqualTo(before);
    }
}
