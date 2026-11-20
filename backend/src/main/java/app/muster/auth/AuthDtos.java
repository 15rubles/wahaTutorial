package app.muster.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank
                    @Size(min = 3, max = 32)
                    @Pattern(
                            regexp = "^[A-Za-z0-9_.-]+$",
                            message = "may only contain letters, digits, '.', '_' and '-'")
                    String username,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 10, max = 128) String password,
            @NotBlank @Size(max = 32) String inviteCode) {

        @Override
        public String toString() {
            return "RegisterRequest[username=" + username + "]";
        }
    }

    public record LoginRequest(@NotBlank @Size(max = 32) String username, @NotBlank @Size(max = 128) String password) {

        @Override
        public String toString() {
            return "LoginRequest[username=" + username + "]";
        }
    }

    public record MeResponse(long id, String username, String email, Role role) {

        static MeResponse of(AppUser u) {
            return new MeResponse(u.getId(), u.getUsername(), u.getEmail(), u.getRole());
        }
    }

    public record CsrfResponse(String headerName, String token) {}
}
