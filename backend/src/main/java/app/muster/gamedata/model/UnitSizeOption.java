package app.muster.gamedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;
import java.util.Optional;

/**
 * One unit size. {@code points} is the price of the first copy; {@code tiers} holds the full price
 * list when the source prices later copies of the same datasheet differently.
 */
public record UnitSizeOption(
        String key, String datasheet, String name, int models, Optional<Integer> points, List<PointsTier> tiers)
        implements GameEntity {

    public UnitSizeOption {
        tiers = tiers == null ? List.of() : List.copyOf(tiers);
    }

    public UnitSizeOption(String key, String datasheet, String name, int models, Optional<Integer> points) {
        this(key, datasheet, name, models, points, List.of());
    }

    /** Points for the n-th copy (1-based) of this datasheet in a context; empty when the data has no price. */
    @JsonIgnore
    public Optional<Integer> pointsFor(int copy, Optional<String> context) {
        if (tiers.isEmpty()) return points;
        List<PointsTier> inContext = tiers.stream()
                .filter(t -> context.map(c -> t.context().map(c::equals).orElse(true)).orElse(t.context().isEmpty()))
                .toList();
        List<PointsTier> pool = inContext.isEmpty() ? tiers : inContext;
        return pool.stream().filter(t -> t.covers(copy)).findFirst().or(() -> pool.stream().reduce((a, b) -> b))
                .map(PointsTier::points);
    }

    /** Pricing contexts printed for this size, in source order. */
    @JsonIgnore
    public List<String> contexts() {
        return tiers.stream().map(PointsTier::context).flatMap(Optional::stream).distinct().toList();
    }

    @Override
    public EntityType type() {
        return EntityType.UNIT_SIZE;
    }

    @Override
    public Optional<String> parentKey() {
        return Optional.of(datasheet);
    }
}
