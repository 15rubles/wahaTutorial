package app.muster.roster;

import app.muster.roster.model.RosterFlags;
import app.muster.roster.model.WargearChoice;
import app.muster.roster.rules.Violation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class RosterDtos {

    private RosterDtos() {}

    public record CreateRoster(
            @NotBlank @Size(max = 100) String name, @NotBlank @Size(max = 120) String factionKey, @Size(max = 300) String battleSizeKey) {}

    public record ConfigPatch(
            @Size(min = 1, max = 100) String name,
            @Size(max = 300) String battleSizeKey,
            Map<@Size(max = 300) String, @Size(max = 300) String> factionOptions,
            @Size(max = 300) String forceDisposition,
            Boolean clearForceDisposition,
            RosterFlags flags) {}

    public record DetachmentsPut(@NotNull @Size(max = 10) List<@NotBlank @Size(max = 300) String> detachmentKeys) {}

    public record AddEntry(@NotBlank @Size(max = 300) String datasheetKey, @Size(max = 300) String sizeKey) {}

    public record EntryPatch(
            @Size(max = 300) String sizeKey,
            @Size(max = 50) List<@Valid WargearChoice> wargear,
            @Size(max = 300) String enhancementKey,
            Boolean clearEnhancement,
            Boolean warlord,
            Long attachedTo,
            Boolean detach,
            @Min(0) @Max(10000) Integer sortOrder) {}

    public record RenameCopy(@Size(min = 1, max = 100) String name) {}

    public record EntryView(
            long id,
            String datasheetKey,
            String name,
            Optional<String> role,
            String sizeKey,
            Optional<String> sizeName,
            int models,
            List<WargearChoice> wargear,
            Optional<String> enhancementKey,
            Optional<String> enhancementName,
            boolean warlord,
            Optional<Long> attachedTo,
            int sortOrder,
            int points,
            boolean pointsComplete,
            boolean missing) {}

    public record Totals(
            int points,
            boolean pointsComplete,
            Optional<Integer> pointsLimit,
            int dp,
            Optional<Integer> dpBudget,
            int enhancements,
            Optional<Integer> enhancementLimit,
            boolean legal,
            int errors,
            int warnings) {}

    public record VersionInfo(long rosterVersion, Optional<Long> activeVersion, boolean outdated) {}

    public record RosterView(
            long id,
            String name,
            String factionKey,
            String factionName,
            VersionInfo version,
            Optional<String> battleSizeKey,
            Map<String, String> factionOptions,
            Optional<String> forceDisposition,
            RosterFlags flags,
            List<String> detachments,
            List<EntryView> entries,
            Totals totals,
            List<Violation> violations,
            Instant createdAt,
            Instant updatedAt) {}

    public record RosterSummary(
            long id,
            String name,
            String factionKey,
            String factionName,
            Optional<String> battleSizeKey,
            int points,
            boolean legal,
            boolean outdated,
            Instant updatedAt) {}

    public record PointsChange(long entryId, String name, int before, int after) {}

    public record DataUpdatePreview(
            long rosterVersion,
            long activeVersion,
            int totalBefore,
            int totalAfter,
            List<PointsChange> changes,
            List<String> removedUnits) {}
}
