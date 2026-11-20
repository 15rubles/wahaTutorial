package app.muster.gamedata.model;

import java.util.Optional;

/** Common shape of every stored game data record. */
public sealed interface GameEntity
        permits Faction, ArmyRule, FactionOption, Datasheet, UnitSizeOption, Weapon, WargearOption, Ability,
                Detachment, Enhancement, Stratagem, BattleSize, ForceDisposition, GlossaryEntry {

    String key();

    String name();

    EntityType type();

    /** Faction this entity belongs to, if any (core data has none). */
    default Optional<String> factionKey() {
        return Optional.empty();
    }

    /** Owning entity (datasheet for weapons, detachment for enhancements...). */
    default Optional<String> parentKey() {
        return Optional.empty();
    }
}
