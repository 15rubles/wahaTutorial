package app.muster.roster;

import app.muster.roster.model.RosterFlags;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

public record RosterRow(
        long id,
        long ownerId,
        String name,
        String factionKey,
        long dataVersionId,
        Optional<String> battleSizeKey,
        Map<String, String> factionOptions,
        Optional<String> forceDisposition,
        RosterFlags flags,
        int pointsTotal,
        boolean legal,
        Instant createdAt,
        Instant updatedAt) {}
