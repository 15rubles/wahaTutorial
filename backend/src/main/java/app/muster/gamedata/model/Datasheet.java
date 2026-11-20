package app.muster.gamedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import java.util.Optional;

public record Datasheet(
        String key,
        String faction,
        String name,
        Optional<String> role,
        List<String> keywords,
        List<String> factionKeywords,
        List<StatProfile> profiles,
        boolean legends,
        List<String> leaderOf,
        Optional<Integer> maxCopies,
        Optional<String> composition,
        Optional<String> loadout)
        implements GameEntity {

    public Datasheet {
        keywords = keywords == null ? List.of() : List.copyOf(keywords);
        factionKeywords = factionKeywords == null ? List.of() : List.copyOf(factionKeywords);
        profiles = profiles == null ? List.of() : List.copyOf(profiles);
        leaderOf = leaderOf == null ? List.of() : List.copyOf(leaderOf);
    }

    @Override
    public EntityType type() {
        return EntityType.DATASHEET;
    }

    @Override
    public Optional<String> factionKey() {
        return Optional.of(faction);
    }

    @JsonIgnore
    public boolean hasKeyword(String keyword) {
        return keywords.stream().anyMatch(k -> k.equalsIgnoreCase(keyword))
                || factionKeywords.stream().anyMatch(k -> k.equalsIgnoreCase(keyword));
    }
}
