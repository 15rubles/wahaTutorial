package app.muster.gamedata.model;

public record ForceDisposition(String key, String name, RulesText text) implements GameEntity {

    @Override
    public EntityType type() {
        return EntityType.FORCE_DISPOSITION;
    }
}
