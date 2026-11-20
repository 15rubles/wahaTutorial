package app.muster.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class AdminBootstrapTest {

    private final AppUserRepository users = mock(AppUserRepository.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);

    private AdminBootstrap bootstrap(String user, String password) {
        AuthProperties props = mock(AuthProperties.class);
        when(props.admin()).thenReturn(new AuthProperties.Admin(user, password, ""));
        return new AdminBootstrap(users, encoder, props, clock);
    }

    @Test
    void createsTheAdminWhenMissing() {
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.empty());
        bootstrap("admin", "first-password").run(null);
        verify(users).save(any(AppUser.class));
    }

    @Test
    void appliesAChangedPasswordAndClearsTheLockout() {
        AppUser admin = new AppUser("admin", "a@localhost", encoder.encode("old-password-1"), Role.ADMIN, clock.instant());
        admin.applyLoginState(new LoginLockPolicy.State(10, Optional.of(clock.instant().plus(Duration.ofMinutes(15)))));
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.of(admin));

        bootstrap("admin", "new-password-1").run(null);

        assertThat(encoder.matches("new-password-1", admin.getPasswordHash())).isTrue();
        assertThat(admin.getFailedLogins()).isZero();
        assertThat(admin.getLockedUntil()).isEmpty();
        verify(users, never()).save(any());
    }

    @Test
    void neverPromotesARegularUser() {
        AppUser user = new AppUser("admin", "u@x", encoder.encode("user-password"), Role.USER, clock.instant());
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.of(user));
        bootstrap("admin", "new-password-1").run(null);
        assertThat(user.getRole()).isEqualTo(Role.USER);
        assertThat(encoder.matches("user-password", user.getPasswordHash())).isTrue();
    }
}
