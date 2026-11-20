package app.muster.roster.rules;

import app.muster.gamedata.model.Detachment;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Two detachments cannot share a unique tag. */
public final class DetachmentUniqueTagRule implements RosterRule {

    @Override
    public List<Violation> check(RosterSnapshot roster, RosterData data) {
        List<Violation> out = new ArrayList<>();
        Map<String, String> owner = new HashMap<>();
        for (String key : roster.detachments()) {
            Optional<Detachment> d = data.detachment(key);
            if (d.isEmpty()) continue;
            for (String tag : d.get().uniqueTags()) {
                String t = tag.toLowerCase(Locale.ROOT);
                String other = owner.putIfAbsent(t, d.get().name());
                if (other != null && !other.equals(d.get().name())) {
                    out.add(Violation.error("UNIQUE_TAG", other + " and " + d.get().name() + " share the unique tag \"" + tag + "\""));
                }
            }
        }
        return out;
    }
}
