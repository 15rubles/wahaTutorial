package app.muster.web;

import java.util.List;

/** The one JSON error shape used by every endpoint (DESIGN.md section 10). */
public record ApiError(String code, String message, List<FieldError> fieldErrors) {

    public record FieldError(String field, String message) {}

    public static ApiError of(String code, String message) {
        return new ApiError(code, message, List.of());
    }
}
