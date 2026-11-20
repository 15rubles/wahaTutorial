package app.muster.roster;

import app.muster.auth.AuthUser;
import app.muster.auth.CurrentUser;
import app.muster.roster.RosterDtos.AddEntry;
import app.muster.roster.RosterDtos.ConfigPatch;
import app.muster.roster.RosterDtos.CreateRoster;
import app.muster.roster.RosterDtos.DataUpdatePreview;
import app.muster.roster.RosterDtos.DetachmentsPut;
import app.muster.roster.RosterDtos.EntryPatch;
import app.muster.roster.RosterDtos.RenameCopy;
import app.muster.roster.RosterDtos.RosterSummary;
import app.muster.roster.RosterDtos.RosterView;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Roster API (DESIGN.md 10). Every mutation answers with the full roster: totals and violations included. */
@RestController
@RequestMapping("/api/rosters")
public class RosterController {

    private final RosterService service;

    public RosterController(RosterService service) {
        this.service = service;
    }

    @GetMapping
    public List<RosterSummary> list(@CurrentUser AuthUser me) {
        return service.list(me.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RosterView create(@CurrentUser AuthUser me, @Valid @RequestBody CreateRoster req) {
        return service.create(req, me.id());
    }

    @GetMapping("/{id}")
    public RosterView get(@CurrentUser AuthUser me, @PathVariable long id) {
        return service.get(id, me.id());
    }

    @PatchMapping("/{id}/config")
    public RosterView config(@CurrentUser AuthUser me, @PathVariable long id, @Valid @RequestBody ConfigPatch patch) {
        return service.updateConfig(id, me.id(), patch);
    }

    @PutMapping("/{id}/detachments")
    public RosterView detachments(@CurrentUser AuthUser me, @PathVariable long id, @Valid @RequestBody DetachmentsPut body) {
        return service.setDetachments(id, me.id(), body.detachmentKeys());
    }

    @PostMapping("/{id}/entries")
    @ResponseStatus(HttpStatus.CREATED)
    public RosterView addEntry(@CurrentUser AuthUser me, @PathVariable long id, @Valid @RequestBody AddEntry body) {
        return service.addEntry(id, me.id(), body);
    }

    @PatchMapping("/{id}/entries/{entryId}")
    public RosterView updateEntry(@CurrentUser AuthUser me, @PathVariable long id, @PathVariable long entryId, @Valid @RequestBody EntryPatch body) {
        return service.updateEntry(id, me.id(), entryId, body);
    }

    @DeleteMapping("/{id}/entries/{entryId}")
    public RosterView deleteEntry(@CurrentUser AuthUser me, @PathVariable long id, @PathVariable long entryId) {
        return service.deleteEntry(id, me.id(), entryId);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public RosterView duplicate(@CurrentUser AuthUser me, @PathVariable long id, @Valid @RequestBody(required = false) RenameCopy body) {
        return service.duplicate(id, me.id(), Optional.ofNullable(body).map(RenameCopy::name));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUser AuthUser me, @PathVariable long id) {
        service.delete(id, me.id());
    }

    @GetMapping("/{id}/data-update")
    public DataUpdatePreview previewDataUpdate(@CurrentUser AuthUser me, @PathVariable long id) {
        return service.previewDataUpdate(id, me.id());
    }

    @PostMapping("/{id}/data-update")
    public RosterView applyDataUpdate(@CurrentUser AuthUser me, @PathVariable long id) {
        return service.applyDataUpdate(id, me.id());
    }
}
