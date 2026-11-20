package app.muster.gamedata.model;

import java.util.Optional;

public record UnitSizeOption(String key, String datasheet, String name, int models, Optional<Integer> points)
        implements GameEntity {

    @Override
    public EntityType type() {
        return EntityType.UNIT_SIZE;
    }

    @Override
    public Optional<String> parentKey() {
        return Optional.of(datasheet);
    }
}
