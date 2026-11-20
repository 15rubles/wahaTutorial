package app.muster.gamedata.build;

import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.Source;
import java.util.List;
import java.util.Set;

/** Field priority rules from DESIGN.md 5.2. MANUAL is applied separately, always last (it always wins). */
public final class MergePolicy {

    private static final List<Source> POINTS = List.of(Source.MFM, Source.WAHAPEDIA, Source.BATTLESCRIBE);
    private static final List<Source> TEXT = List.of(Source.WAHAPEDIA, Source.BATTLESCRIBE, Source.MFM);
    private static final List<Source> WARGEAR = List.of(Source.BATTLESCRIBE, Source.WAHAPEDIA, Source.MFM);

    private static final Set<String> POINT_FIELDS = Set.of("points");

    private MergePolicy() {}

    /** Sources in priority order (highest first) for one field of one entity type. */
    public static List<Source> priority(EntityType type, String field) {
        if (POINT_FIELDS.contains(field) && (type == EntityType.UNIT_SIZE || type == EntityType.ENHANCEMENT)) {
            return POINTS;
        }
        if (type == EntityType.WARGEAR_OPTION) {
            return WARGEAR;
        }
        return TEXT;
    }
}
