package app.muster.gamedata.build;

import app.muster.gamedata.model.EntityType;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** The import report the admin reviews before activating a version (DESIGN.md 5.3). */
public record VersionReport(
        Map<String, Long> sourceImports,
        Map<String, Map<String, Integer>> counts,
        List<ImportReport.Issue> issues,
        Diff diff,
        int phaseTagsToReview,
        int overridesApplied) {

    public record Change(EntityType type, String key, String name, Optional<String> faction) {}

    public record PointsChange(
            EntityType type, String key, String name, Optional<String> faction, Optional<Integer> before, Optional<Integer> after) {}

    public record Diff(
            Optional<Long> comparedToVersion,
            List<Change> added,
            List<Change> removed,
            List<Change> changed,
            List<PointsChange> points) {

        public static final Diff NONE = new Diff(Optional.empty(), List.of(), List.of(), List.of(), List.of());
    }

    public static final VersionReport EMPTY = new VersionReport(Map.of(), Map.of(), List.of(), Diff.NONE, 0, 0);
}
