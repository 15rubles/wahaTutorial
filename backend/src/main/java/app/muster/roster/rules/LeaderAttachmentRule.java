package app.muster.roster.rules;

import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Enhancement;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Leaders attach only to units their datasheet (or their enhancement) lists; a unit that is attached
 * cannot have others attached to it; each bodyguard takes at most one leader and one support unit; and
 * every support unit must be attached.
 */
public final class LeaderAttachmentRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        Map<Long, List<RosterEntry>> leaders = new LinkedHashMap<>();
        Map<Long, List<RosterEntry>> supports = new LinkedHashMap<>();
        for (RosterEntry e : roster.entries()) {
            Optional<Datasheet> d = data.datasheet(e.datasheetKey());
            if (d.isEmpty()) continue;
            if (e.attachedTo().isEmpty()) {
                if (d.get().support()) out.add(Violation.error("SUPPORT_UNATTACHED", d.get().name() + " is a support unit and must be attached to a unit", e.id()));
                continue;
            }
            long targetId = e.attachedTo().get();
            Optional<RosterEntry> target = roster.entry(targetId);
            if (target.isEmpty() || targetId == e.id()) {
                out.add(Violation.error("ATTACH_TARGET_MISSING", d.get().name() + " is attached to a unit that is not in the list", e.id()));
                continue;
            }
            if (target.get().attachedTo().isPresent()) {
                out.add(Violation.error("ATTACH_CHAIN", d.get().name() + " is attached to a unit that is itself attached", e.id(), targetId));
                continue;
            }
            Optional<Datasheet> td = data.datasheet(target.get().datasheetKey());
            if (td.isEmpty()) continue;
            List<String> allowed = new ArrayList<>(d.get().leaderOf());
            e.enhancementKey().flatMap(data::enhancement).map(Enhancement::grantsLeaderOf).ifPresent(allowed::addAll);
            if (!allowed.contains(td.get().key())) {
                out.add(Violation.error("ATTACH_NOT_ALLOWED", d.get().name() + " cannot lead " + td.get().name(), e.id(), targetId));
                continue;
            }
            (d.get().support() ? supports : leaders).computeIfAbsent(targetId, k -> new ArrayList<>()).add(e);
        }
        leaders.forEach((target, list) -> {
            if (list.size() > 1) {
                List<Long> ids = new ArrayList<>(list.stream().map(RosterEntry::id).toList());
                ids.add(target);
                out.add(new Violation(Severity.ERROR, "TOO_MANY_LEADERS", "A unit can only have one leader attached", ids));
            }
        });
        supports.forEach((target, list) -> {
            if (list.size() > 1) {
                List<Long> ids = new ArrayList<>(list.stream().map(RosterEntry::id).toList());
                ids.add(target);
                out.add(new Violation(Severity.ERROR, "TOO_MANY_SUPPORTS", "A unit can only have one support unit attached", ids));
            }
        });
        return out;
    }
}
