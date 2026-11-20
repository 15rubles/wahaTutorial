package app.muster.gamedata.model;

import java.util.List;
import java.util.Optional;

public record Enhancement(
        String key,
        String detachment,
        String faction,
        String name,
        Optional<Integer> points,
        List<String> requiredKeywords,
        List<String> forbiddenKeywords,
        RulesText text,
        PhaseTags tags)
        implements GameEntity {

    public Enhancement {
        requiredKeywords = requiredKeywords == null ? List.of() : List.copyOf(requiredKeywords);
        forbiddenKeywords = forbiddenKeywords == null ? List.of() : List.copyOf(forbiddenKeywords);
        text = text == null ? RulesText.EMPTY : text;
        tags = tags == null ? PhaseTags.NONE : tags;
    }

    @Override
    public EntityType type() {
        return EntityType.ENHANCEMENT;
    }

    @Override
    public Optional<String> factionKey() {
        return Optional.of(faction);
    }

    @Override
    public Optional<String> parentKey() {
        return Optional.of(detachment);
    }
}
