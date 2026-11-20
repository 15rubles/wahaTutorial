package app.muster.gamedata.model;

import java.util.Optional;

public record Ability(
        String key,
        AbilityOwner owner,
        String ownerKey,
        Optional<String> faction,
        String name,
        RulesText text,
        PhaseTags tags,
        Optional<String> glossaryId)
        implements GameEntity {

    @Override
    public EntityType type() {
        return EntityType.ABILITY;
    }

    @Override
    public Optional<String> factionKey() {
        return faction;
    }

    @Override
    public Optional<String> parentKey() {
        return Optional.of(ownerKey);
    }
}
