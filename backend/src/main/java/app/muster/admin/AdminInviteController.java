package app.muster.admin;

import app.muster.admin.InviteDtos.CreateInviteRequest;
import app.muster.admin.InviteDtos.InviteResponse;
import app.muster.auth.AppUserRepository;
import app.muster.auth.AuthProperties;
import app.muster.auth.AuthUser;
import app.muster.auth.CurrentUser;
import app.muster.auth.InviteCode;
import app.muster.auth.InviteCodeRepository;
import app.muster.auth.InviteCodes;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/invites")
public class AdminInviteController {

    private final InviteCodeRepository invites;
    private final AppUserRepository users;
    private final AuthProperties props;
    private final Clock clock;

    public AdminInviteController(
            InviteCodeRepository invites, AppUserRepository users, AuthProperties props, Clock clock) {
        this.invites = invites;
        this.users = users;
        this.props = props;
        this.clock = clock;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public InviteResponse create(@CurrentUser AuthUser me, @Valid @RequestBody(required = false) CreateInviteRequest req) {
        Instant now = clock.instant();
        Duration validity = req != null && req.validDays() != null
                ? Duration.ofDays(req.validDays())
                : props.inviteDefaultValidity();
        InviteCode invite = invites.save(
                new InviteCode(InviteCodes.generate(), users.getReferenceById(me.id()), now, now.plus(validity)));
        return InviteResponse.of(invites.findById(invite.getId()).orElseThrow(), now);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<InviteResponse> list() {
        Instant now = clock.instant();
        return invites.findAllNewestFirst().stream().map(i -> InviteResponse.of(i, now)).toList();
    }
}
