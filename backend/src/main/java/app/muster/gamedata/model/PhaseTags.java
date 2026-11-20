package app.muster.gamedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

/**
 * When a rule applies. {@code inferred} is true when the phase inference parser produced the tags
 * from the rules text; {@code confirmed} is true once an admin reviewed them.
 */
public record PhaseTags(List<Phase> phases, Timing timing, boolean inferred, boolean confirmed) {

    public static final PhaseTags NONE = new PhaseTags(List.of(), Timing.ANY, false, false);

    public PhaseTags {
        phases = phases == null ? List.of() : List.copyOf(phases);
        timing = timing == null ? Timing.ANY : timing;
    }

    @JsonIgnore
    public boolean isEmpty() {
        return phases.isEmpty();
    }

    @JsonIgnore
    public boolean needsReview() {
        return !confirmed && (inferred || phases.isEmpty());
    }
}
