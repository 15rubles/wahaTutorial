package app.muster.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LoginLockPolicyTest {

    private final LoginLockPolicy policy = new LoginLockPolicy(10, Duration.ofMinutes(15));
    private final Instant t0 = Instant.parse("2026-01-01T12:00:00Z");

    @Test
    void locksOnTheTenthFailureInARow() {
        LoginLockPolicy.State s = LoginLockPolicy.State.CLEAN;
        for (int i = 1; i <= 9; i++) {
            s = policy.onFailure(s, t0);
            assertThat(s.failedLogins()).isEqualTo(i);
            assertThat(policy.isLocked(s, t0)).isFalse();
        }
        s = policy.onFailure(s, t0);
        assertThat(policy.isLocked(s, t0)).isTrue();
        assertThat(s.lockedUntil()).contains(t0.plus(Duration.ofMinutes(15)));
    }

    @Test
    void lockExpiresAfterFifteenMinutes() {
        var locked = new LoginLockPolicy.State(0, Optional.of(t0.plus(Duration.ofMinutes(15))));
        assertThat(policy.isLocked(locked, t0.plus(Duration.ofMinutes(14)))).isTrue();
        assertThat(policy.isLocked(locked, t0.plus(Duration.ofMinutes(15)))).isFalse();
    }

    @Test
    void failureAfterExpiredLockStartsCountingAgain() {
        var expired = new LoginLockPolicy.State(0, Optional.of(t0));
        var next = policy.onFailure(expired, t0.plusSeconds(1));
        assertThat(next).isEqualTo(new LoginLockPolicy.State(1, Optional.empty()));
    }

    @Test
    void successResets() {
        assertThat(policy.onSuccess()).isEqualTo(LoginLockPolicy.State.CLEAN);
    }

    @Test
    void rejectsNonsenseConfig() {
        assertThatThrownBy(() -> new LoginLockPolicy(0, Duration.ofMinutes(1))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new LoginLockPolicy(1, Duration.ZERO)).isInstanceOf(IllegalArgumentException.class);
    }
}
