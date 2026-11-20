package app.muster.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Optional;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32)
    private String username;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Role role;

    @Column(name = "failed_logins", nullable = false)
    private int failedLogins;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AppUser() {}

    public AppUser(String username, String email, String passwordHash, Role role, Instant createdAt) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public int getFailedLogins() {
        return failedLogins;
    }

    public Optional<Instant> getLockedUntil() {
        return Optional.ofNullable(lockedUntil);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    /** Sets a new password hash and clears any lockout (used by the admin bootstrap). */
    void resetPassword(String passwordHash) {
        this.passwordHash = passwordHash;
        this.failedLogins = 0;
        this.lockedUntil = null;
    }

    void applyLoginState(LoginLockPolicy.State state) {
        this.failedLogins = state.failedLogins();
        this.lockedUntil = state.lockedUntil().orElse(null);
    }

    LoginLockPolicy.State loginState() {
        return new LoginLockPolicy.State(failedLogins, getLockedUntil());
    }
}
