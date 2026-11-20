package app.muster.gamedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Optional;

/** A stratagem. Core stratagems have no faction and no detachment. */
public record Stratagem(
        String key,
        Optional<String> detachment,
        Optional<String> faction,
        String name,
        Optional<Integer> cpCost,
        Optional<String> category,
        PhaseTags tags,
        RulesText when,
        RulesText target,
        RulesText effect,
        RulesText restrictions,
        RulesText fullText)
        implements GameEntity {

    public Stratagem {
        tags = tags == null ? PhaseTags.NONE : tags;
        when = when == null ? RulesText.EMPTY : when;
        target = target == null ? RulesText.EMPTY : target;
        effect = effect == null ? RulesText.EMPTY : effect;
        restrictions = restrictions == null ? RulesText.EMPTY : restrictions;
        fullText = fullText == null ? RulesText.EMPTY : fullText;
    }

    @Override
    public EntityType type() {
        return EntityType.STRATAGEM;
    }

    @Override
    public Optional<String> factionKey() {
        return faction;
    }

    @Override
    public Optional<String> parentKey() {
        return detachment;
    }

    @JsonIgnore
    public boolean isCore() {
        return faction.isEmpty() && detachment.isEmpty();
    }
}
