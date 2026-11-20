package app.muster.roster.rules;


import app.muster.gamedata.model.ForceDisposition;
import app.muster.roster.model.RosterSnapshot;
import java.util.List;
import java.util.Optional;

/** The chosen force disposition must be one the selected detachments give access to. */
public final class ForceDispositionRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<String> offered = roster.detachments().stream()
                .map(data::detachment).flatMap(Optional::stream)
                .flatMap(d -> d.forceDispositions().stream())
                .toList();
        if (roster.forceDisposition().isEmpty()) {
            return offered.isEmpty() ? List.of() : List.of(Violation.warning("NO_FORCE_DISPOSITION", "Choose a force disposition"));
        }
        Optional<ForceDisposition> fd = data.faction().core().forceDisposition(roster.forceDisposition().get());
        if (fd.isEmpty()) return List.of(Violation.error("UNKNOWN_FORCE_DISPOSITION", "The force disposition is not in the current data"));
        if (offered.stream().noneMatch(n -> n.equalsIgnoreCase(fd.get().name()))) {
            return List.of(Violation.error("FORCE_DISPOSITION", fd.get().name() + " is not offered by the selected detachments"));
        }
        return List.of();
    }

}
