package app.muster.auth;

import app.muster.auth.AuthDtos.LoginRequest;
import app.muster.auth.AuthDtos.RegisterRequest;
import app.muster.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    // Hash compared against when the username does not exist, so timing does not leak which names exist.
    private final String dummyHash;

    private final AppUserRepository users;
    private final InviteCodeRepository invites;
    private final PasswordEncoder encoder;
    private final LoginLockPolicy lockPolicy;
    private final Clock clock;

    public AuthService(
            AppUserRepository users,
            InviteCodeRepository invites,
            PasswordEncoder encoder,
            AuthProperties props,
            Clock clock) {
        this.users = users;
        this.invites = invites;
        this.encoder = encoder;
        this.lockPolicy = new LoginLockPolicy(props.maxFailedLogins(), props.lockDuration());
        this.clock = clock;
        this.dummyHash = encoder.encode("not-a-real-password-" + System.nanoTime());
    }

    @Transactional
    public AppUser register(RegisterRequest req) {
        Instant now = clock.instant();
        InviteCode invite = invites.findByCodeForUpdate(InviteCodes.normalize(req.inviteCode()))
                .orElseThrow(() -> ApiException.badRequest("INVITE_INVALID", "This invite code does not exist"));
        switch (invite.status(now)) {
            case USED -> throw ApiException.badRequest("INVITE_USED", "This invite code has already been used");
            case EXPIRED -> throw ApiException.badRequest("INVITE_EXPIRED", "This invite code has expired");
            case ACTIVE -> {}
        }
        String username = req.username().trim();
        String email = req.email().trim();
        if (users.existsByUsernameIgnoreCase(username)) {
            throw ApiException.conflict("USERNAME_TAKEN", "This username is already taken");
        }
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("EMAIL_TAKEN", "This email is already registered");
        }
        AppUser user = users.save(new AppUser(username, email, encoder.encode(req.password()), Role.USER, now));
        invite.markUsed(user, now);
        return user;
    }

    /**
     * Checks credentials and applies the lockout policy. Runs in its own transaction so failed
     * attempts are counted even though the method throws.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public AppUser login(LoginRequest req) {
        Instant now = clock.instant();
        AppUser user = users.findByUsernameIgnoreCase(req.username().trim()).orElse(null);
        if (user == null) {
            encoder.matches(req.password(), dummyHash);
            throw badCredentials();
        }
        LoginLockPolicy.State state = user.loginState();
        if (lockPolicy.isLocked(state, now)) {
            throw locked(Duration.between(now, state.lockedUntil().orElseThrow()));
        }
        if (!encoder.matches(req.password(), user.getPasswordHash())) {
            LoginLockPolicy.State next = lockPolicy.onFailure(state, now);
            user.applyLoginState(next);
            if (lockPolicy.isLocked(next, now)) {
                throw locked(Duration.between(now, next.lockedUntil().orElseThrow()));
            }
            throw badCredentials();
        }
        user.applyLoginState(lockPolicy.onSuccess());
        return user;
    }

    private static ApiException badCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Wrong username or password");
    }

    private static ApiException locked(Duration remaining) {
        long minutes = Math.max(1, (remaining.toSeconds() + 59) / 60);
        return new ApiException(
                HttpStatus.LOCKED,
                "ACCOUNT_LOCKED",
                "Too many failed logins. Try again in " + minutes + " minute" + (minutes == 1 ? "" : "s") + ".");
    }
}
