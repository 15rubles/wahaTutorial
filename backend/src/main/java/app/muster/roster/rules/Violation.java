package app.muster.roster.rules;

import java.util.List;

public record Violation(Severity severity, String code, String message, List<Long> entryIds) {

    public Violation {
        entryIds = entryIds == null ? List.of() : List.copyOf(entryIds);
    }

    public static Violation error(String code, String message, Long... entries) {
        return new Violation(Severity.ERROR, code, message, List.of(entries));
    }

    public static Violation warning(String code, String message, Long... entries) {
        return new Violation(Severity.WARNING, code, message, List.of(entries));
    }

    public static Violation info(String code, String message, Long... entries) {
        return new Violation(Severity.INFO, code, message, List.of(entries));
    }
}
