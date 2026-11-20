package app.muster.auth;

import app.muster.auth.AuthDtos.CsrfResponse;
import app.muster.auth.AuthDtos.LoginRequest;
import app.muster.auth.AuthDtos.MeResponse;
import app.muster.auth.AuthDtos.RegisterRequest;
import app.muster.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService auth;
    private final SessionLogin sessionLogin;
    private final AppUserRepository users;

    public AuthController(AuthService auth, SessionLogin sessionLogin, AppUserRepository users) {
        this.auth = auth;
        this.sessionLogin = sessionLogin;
        this.users = users;
    }

    /** Makes sure the XSRF-TOKEN cookie exists and returns the token for clients that want it. */
    @GetMapping("/api/auth/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    @PostMapping("/api/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MeResponse register(
            @Valid @RequestBody RegisterRequest req, HttpServletRequest request, HttpServletResponse response) {
        AppUser user = auth.register(req);
        sessionLogin.signIn(user, request, response);
        return MeResponse.of(user);
    }

    @PostMapping("/api/auth/login")
    public MeResponse login(
            @Valid @RequestBody LoginRequest req, HttpServletRequest request, HttpServletResponse response) {
        AppUser user = auth.login(req);
        sessionLogin.signIn(user, request, response);
        return MeResponse.of(user);
    }

    @GetMapping("/api/me")
    public MeResponse me(@CurrentUser AuthUser me) {
        return users.findById(me.id())
                .map(MeResponse::of)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Not signed in"));
    }
}
