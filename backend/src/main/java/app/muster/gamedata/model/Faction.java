package app.muster.gamedata.model;

import java.util.Optional;

public record Faction(String key, String name, Optional<String> parentKey, Optional<Allegiance> allegiance)
        implements GameEntity {

    @Override
    public EntityType type() {
        return EntityType.FACTION;
    }

    @Override
    public Optional<String> factionKey() {
        return Optional.of(key);
    }
}
