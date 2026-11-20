package app.muster.gamedata.model;

import java.util.Optional;

public record ArmyRule(String key, String faction, String name, RulesText text) implements GameEntity {

    @Override
    public EntityType type() {
        return EntityType.ARMY_RULE;
    }

    @Override
    public Optional<String> factionKey() {
        return Optional.of(faction);
    }
}
