package app.muster.gamedata.model;

import java.util.List;
import java.util.Optional;

/** A faction-wide configuration choice (for example a code or oath picked for the whole army). */
public record FactionOption(String key, String faction, String name, List<Value> values) implements GameEntity {

    public record Value(String name, RulesText text) {}

    public FactionOption {
        values = values == null ? List.of() : List.copyOf(values);
    }

    @Override
    public EntityType type() {
        return EntityType.FACTION_OPTION;
    }

    @Override
    public Optional<String> factionKey() {
        return Optional.of(faction);
    }
}
