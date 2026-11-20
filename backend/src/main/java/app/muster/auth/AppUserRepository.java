package app.muster.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    @Query("select u from AppUser u where lower(u.username) = lower(?1)")
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    @Query("select count(u) > 0 from AppUser u where lower(u.username) = lower(?1)")
    boolean existsByUsernameIgnoreCase(String username);

    @Query("select count(u) > 0 from AppUser u where lower(u.email) = lower(?1)")
    boolean existsByEmailIgnoreCase(String email);

    boolean existsByRole(Role role);
}
