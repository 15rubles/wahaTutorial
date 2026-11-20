package app.muster.auth;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD when no admin exists yet. */
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
        if (users.existsByRole(Role.ADMIN)) return;
        AuthProperties.Admin admin = props.admin();
        if (admin == null || isBlank(admin.username()) || isBlank(admin.password())) {
            log.warn("No admin account exists and ADMIN_USERNAME / ADMIN_PASSWORD are not set");
            return;
        }
        if (users.existsByUsernameIgnoreCase(admin.username())) {
            log.warn("ADMIN_USERNAME '{}' already exists as a regular user, not promoting it", admin.username());
            return;
        }
        if (admin.password().length() < 10) {
            log.warn("ADMIN_PASSWORD must have at least 10 characters, admin not created");
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
