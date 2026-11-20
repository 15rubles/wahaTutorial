package app.muster.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Optional;

@Entity
@Table(name = "invite_code")
public class InviteCode {

    public enum Status {
        ACTIVE,
        USED,
        EXPIRED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 32)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by")
    private AppUser createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "used_by")
    private AppUser usedBy;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected InviteCode() {}

    public InviteCode(String code, AppUser createdBy, Instant createdAt, Instant expiresAt) {
        this.code = code;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public Status status(Instant now) {
        if (usedBy != null) return Status.USED;
        return now.isBefore(expiresAt) ? Status.ACTIVE : Status.EXPIRED;
    }

    void markUsed(AppUser user, Instant now) {
        if (usedBy != null) throw new IllegalStateException("Invite already used");
        this.usedBy = user;
        this.usedAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public AppUser getCreatedBy() {
        return createdBy;
    }

    public Optional<AppUser> getUsedBy() {
        return Optional.ofNullable(usedBy);
    }

    public Optional<Instant> getUsedAt() {
        return Optional.ofNullable(usedAt);
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
