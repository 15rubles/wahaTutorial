package app.muster.gamedata.model;

import java.util.List;
import java.util.Optional;

/**
 * A wargear choice group. {@code max} applies per {@code perModels} models when set (for example
 * "1 per 5 models"), otherwise per unit.
 */
public record WargearOption(
        String key,
        String datasheet,
        String name,
        String description,
        List<String> choices,
        Optional<Integer> min,
        Optional<Integer> max,
        Optional<Integer> perModels,
        Optional<Integer> pointsDelta)
        implements GameEntity {

    public WargearOption {
        choices = choices == null ? List.of() : List.copyOf(choices);
        description = description == null ? "" : description;
    }

    @Override
    public EntityType type() {
        return EntityType.WARGEAR_OPTION;
    }

    @Override
    public Optional<String> parentKey() {
        return Optional.of(datasheet);
    }
}
