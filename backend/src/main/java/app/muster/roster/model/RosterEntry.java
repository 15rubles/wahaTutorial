package app.muster.roster.model;

import java.util.List;
import java.util.Optional;

/** One unit in a roster, referencing game data by stable keys. */
public record RosterEntry(
        long id,
        String datasheetKey,
        String sizeKey,
        List<WargearChoice> wargear,
        Optional<String> enhancementKey,
        boolean warlord,
        Optional<Long> attachedTo,
        int sortOrder) {

    public RosterEntry {
        wargear = wargear == null ? List.of() : List.copyOf(wargear);
    }
}
