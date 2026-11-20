package app.muster.roster.model;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Everything the validation rules look at, as plain immutable data. */
public record RosterSnapshot(
        long id,
        String name,
        String factionKey,
        Optional<String> battleSizeKey,
        Map<String, String> factionOptions,
        Optional<String> forceDisposition,
        RosterFlags flags,
        List<String> detachments,
        List<RosterEntry> entries) {

    public RosterSnapshot {
        factionOptions = factionOptions == null ? Map.of() : Map.copyOf(factionOptions);
        detachments = detachments == null ? List.of() : List.copyOf(detachments);
        entries = entries == null ? List.of() : entries.stream().sorted(java.util.Comparator.comparingInt(RosterEntry::sortOrder)).toList();
        flags = flags == null ? RosterFlags.DEFAULT : flags;
    }

    public Optional<RosterEntry> entry(long id) {
        return entries.stream().filter(e -> e.id() == id).findFirst();
    }
}
