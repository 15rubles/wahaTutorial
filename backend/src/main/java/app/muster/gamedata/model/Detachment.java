package app.muster.gamedata.model;

import java.util.List;
import java.util.Optional;

public record Detachment(
        String key,
        String faction,
        String name,
        Optional<Integer> dpCost,
        List<String> uniqueTags,
        Optional<String> ruleName,
        RulesText ruleText,
        Optional<String> restrictions,
        List<String> forceDispositions)
        implements GameEntity {

    public Detachment {
        uniqueTags = uniqueTags == null ? List.of() : List.copyOf(uniqueTags);
        forceDispositions = forceDispositions == null ? List.of() : List.copyOf(forceDispositions);
        ruleText = ruleText == null ? RulesText.EMPTY : ruleText;
    }

    @Override
    public EntityType type() {
        return EntityType.DETACHMENT;
    }

    @Override
    public Optional<String> factionKey() {
        return Optional.of(faction);
    }
}
