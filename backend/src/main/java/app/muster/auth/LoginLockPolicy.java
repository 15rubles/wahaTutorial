package app.muster.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Pure login lockout rules: after {@code maxFailures} failed logins in a row the account is locked
 * for {@code lockDuration}. A successful login resets the counter.
 */
public record LoginLockPolicy(int maxFailures, Duration lockDuration) {

    public LoginLockPolicy {
        if (maxFailures < 1) throw new IllegalArgumentException("maxFailures must be >= 1");
        if (lockDuration.isNegative() || lockDuration.isZero()) {
            throw new IllegalArgumentException("lockDuration must be positive");
        }
    }

    public record State(int failedLogins, Optional<Instant> lockedUntil) {
        public static final State CLEAN = new State(0, Optional.empty());
    }

    public boolean isLocked(State state, Instant now) {
        return state.lockedUntil().map(now::isBefore).orElse(false);
    }

    public State onFailure(State state, Instant now) {
        // An expired lock starts a fresh count.
        int previous = state.lockedUntil().isPresent() && !isLocked(state, now) ? 0 : state.failedLogins();
        int failures = previous + 1;
        if (failures >= maxFailures) {
            return new State(0, Optional.of(now.plus(lockDuration)));
        }
        return new State(failures, Optional.empty());
    }

    public State onSuccess() {
        return State.CLEAN;
    }
}
