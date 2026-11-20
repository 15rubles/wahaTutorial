package app.muster.gamedata.model;

/** Every kind of game data entity, with the Java record that holds its data. */
public enum EntityType {
    FACTION(Faction.class),
    ARMY_RULE(ArmyRule.class),
    FACTION_OPTION(FactionOption.class),
    DATASHEET(Datasheet.class),
    UNIT_SIZE(UnitSizeOption.class),
    WEAPON(Weapon.class),
    WARGEAR_OPTION(WargearOption.class),
    ABILITY(Ability.class),
    DETACHMENT(Detachment.class),
    ENHANCEMENT(Enhancement.class),
    STRATAGEM(Stratagem.class),
    BATTLE_SIZE(BattleSize.class),
    FORCE_DISPOSITION(ForceDisposition.class),
    GLOSSARY(GlossaryEntry.class);

    private final Class<? extends GameEntity> recordType;

    EntityType(Class<? extends GameEntity> recordType) {
        this.recordType = recordType;
    }

    public Class<? extends GameEntity> recordType() {
        return recordType;
    }
}
