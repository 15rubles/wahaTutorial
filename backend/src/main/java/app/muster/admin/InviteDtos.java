package app.muster.admin;

import app.muster.auth.InviteCode;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.util.Optional;

public final class InviteDtos {

    private InviteDtos() {}

    public record CreateInviteRequest(@Min(1) @Max(90) Integer validDays) {}

    public record InviteResponse(
            long id,
            String code,
            InviteCode.Status status,
            String createdBy,
            Instant createdAt,
            Instant expiresAt,
            Optional<String> usedBy,
            Optional<Instant> usedAt) {

        public static InviteResponse of(InviteCode i, Instant now) {
            return new InviteResponse(
                    i.getId(),
                    i.getCode(),
                    i.status(now),
                    i.getCreatedBy().getUsername(),
                    i.getCreatedAt(),
                    i.getExpiresAt(),
                    i.getUsedBy().map(u -> u.getUsername()),
                    i.getUsedAt());
        }
    }
}
