package app.muster.auth;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/** The principal stored in the session. Serializable because sessions live in the database. */
public record AuthUser(long id, String username, Role role) implements UserDetails, Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    public static AuthUser of(AppUser user) {
        return new AuthUser(user.getId(), user.getUsername(), user.getRole());
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return username;
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
