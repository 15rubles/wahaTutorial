package app.muster.gamedata.model;

import java.util.Optional;

/**
 * Price of a unit size for some copies of the same datasheet: copies {@code fromCopy} to
 * {@code toCopy} (inclusive, empty = no upper bound) cost {@code points}. {@code context} names a
 * pricing context printed by the source (for example a price that only applies when the unit is
 * taken by another faction); tiers without context apply everywhere.
 */
public record PointsTier(int fromCopy, Optional<Integer> toCopy, int points, Optional<String> context) {

    public boolean covers(int copy) {
        return copy >= fromCopy && toCopy.map(t -> copy <= t).orElse(true);
    }
}
