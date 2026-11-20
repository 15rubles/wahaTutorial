package app.muster.auth;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps the admin account in line with ADMIN_USERNAME / ADMIN_PASSWORD: creates it when missing, and
 * when it exists, applies a changed password and clears a lockout. Runs at every start.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final AuthProperties props;
    private final Clock clock;

    public AdminBootstrap(AppUserRepository users, PasswordEncoder encoder, AuthProperties props, Clock clock) {
        this.users = users;
        this.encoder = encoder;
        this.props = props;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AuthProperties.Admin admin = props.admin();
        if (admin == null || isBlank(admin.username()) || isBlank(admin.password())) {
            if (!users.existsByRole(Role.ADMIN)) {
                log.warn("NO ADMIN ACCOUNT: set ADMIN_USERNAME and ADMIN_PASSWORD (in .env) and restart the backend");
            }
            return;
        }
        if (admin.password().length() < 10) {
            log.warn("NO ADMIN CHANGE: ADMIN_PASSWORD must have at least 10 characters");
            return;
        }
        var existing = users.findByUsernameIgnoreCase(admin.username());
        if (existing.isPresent()) {
            AppUser user = existing.get();
            if (user.getRole() != Role.ADMIN) {
                log.warn("ADMIN_USERNAME '{}' already exists as a regular user, not promoting it", admin.username());
                return;
            }
            // .env is the source of truth for the admin password: a changed ADMIN_PASSWORD applies on restart.
            if (!encoder.matches(admin.password(), user.getPasswordHash()) || user.getLockedUntil().isPresent()) {
                user.resetPassword(encoder.encode(admin.password()));
                log.info("Admin account '{}': password set from ADMIN_PASSWORD, lockout cleared", user.getUsername());
            }
            return;
        }
        String email = isBlank(admin.email()) ? admin.username() + "@localhost" : admin.email();
        users.save(new AppUser(admin.username(), email, encoder.encode(admin.password()), Role.ADMIN, clock.instant()));
        log.info("Created admin account '{}'", admin.username());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
