package app.muster.auth;

import jakarta.validation.constraints.Min;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "muster.auth")
public record AuthProperties(
        @Min(1) int maxFailedLogins,
        Duration lockDuration,
        Duration inviteDefaultValidity,
        boolean cookieSecure,
        Admin admin) {

    public record Admin(String username, String password, String email) {}
}
