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
        Optional<String> loadout,
        boolean support,
        List<WargearCost> wargearPoints)
        implements GameEntity {

    public Datasheet(
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
            Optional<String> loadout) {
        this(key, faction, name, role, keywords, factionKeywords, profiles, legends, leaderOf, maxCopies, composition, loadout,
                false, List.of());
    }

    public Datasheet {
        wargearPoints = wargearPoints == null ? List.of() : List.copyOf(wargearPoints);
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
