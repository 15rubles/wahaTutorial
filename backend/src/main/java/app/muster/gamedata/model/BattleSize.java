package app.muster.gamedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Map;
import java.util.Optional;

/**
 * A battle size. {@code limits} holds any other numeric limits the data defines, for example
 * {@code maxCopiesPerDatasheet} or {@code maxCopiesBattleline}; rules read them by name.
 */
public record BattleSize(
        String key, String name, Optional<Integer> pointsLimit, Optional<Integer> dpBudget, Map<String, Integer> limits)
        implements GameEntity {

    public static final String LIMIT_MAX_COPIES = "maxCopiesPerDatasheet";
    public static final String LIMIT_MAX_COPIES_BATTLELINE = "maxCopiesBattleline";
    public static final String LIMIT_MIN_BATTLELINE = "minBattlelineUnits";
    public static final String LIMIT_MIN_DETACHMENTS = "minDetachments";

    public BattleSize {
        limits = limits == null ? Map.of() : Map.copyOf(limits);
    }

    @Override
    public EntityType type() {
        return EntityType.BATTLE_SIZE;
    }

    @JsonIgnore
    public Optional<Integer> limit(String name) {
        return Optional.ofNullable(limits.get(name));
    }
}
