package app.muster.gamedata.build;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/** What an importer saw: counts per faction and every problem, never silently dropped. */
public record ImportReport(Map<String, Map<String, Integer>> counts, List<Issue> issues) {

    public enum Level {
        ERROR,
        WARNING,
        INFO
    }

    public record Issue(Level level, String category, String message, Optional<String> faction, Optional<String> ref) {}

    public ImportReport {
        counts = counts == null ? Map.of() : counts;
        issues = issues == null ? List.of() : List.copyOf(issues);
    }

    public static final ImportReport EMPTY = new ImportReport(Map.of(), List.of());

    /** Mutable collector used while importing. */
    public static final class Collector {
        private final Map<String, Map<String, Integer>> counts = new TreeMap<>();
        private final List<Issue> issues = new ArrayList<>();

        public void count(String faction, String what) {
            counts.computeIfAbsent(faction, f -> new TreeMap<>()).merge(what, 1, Integer::sum);
        }

        public void issue(Level level, String category, String message, String faction, String ref) {
            issues.add(new Issue(level, category, message, Optional.ofNullable(faction), Optional.ofNullable(ref)));
        }

        public void warn(String category, String message, String faction, String ref) {
            issue(Level.WARNING, category, message, faction, ref);
        }

        public void error(String category, String message, String faction, String ref) {
            issue(Level.ERROR, category, message, faction, ref);
        }

        public void info(String category, String message, String faction, String ref) {
            issue(Level.INFO, category, message, faction, ref);
        }

        public ImportReport build() {
            return new ImportReport(counts, issues);
        }
    }
}
