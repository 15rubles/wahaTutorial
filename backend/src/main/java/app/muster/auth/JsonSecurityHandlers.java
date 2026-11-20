package app.muster.auth;

import app.muster.web.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;

/** Writes 401 / 403 from the security filter chain in the shared error shape. */
final class JsonSecurityHandlers {

    private JsonSecurityHandlers() {}

    static AuthenticationEntryPoint entryPoint(ObjectMapper json) {
        return (req, res, ex) -> write(json, res, 401, ApiError.of("UNAUTHENTICATED", "Please sign in"));
    }

    static AccessDeniedHandler accessDenied(ObjectMapper json) {
        return (req, res, ex) -> {
            ApiError body = ex instanceof CsrfException
                    ? ApiError.of("CSRF_INVALID", "Missing or invalid CSRF token, reload the page and try again")
                    : ApiError.of("FORBIDDEN", "You are not allowed to do this");
            write(json, res, 403, body);
        };
    }

    private static void write(ObjectMapper json, HttpServletResponse res, int status, ApiError body)
            throws IOException {
        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(res.getOutputStream(), body);
    }
}
