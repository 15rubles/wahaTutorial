package app.muster.gamedata.model;

import java.util.List;
import java.util.Optional;

public record Weapon(
        String key,
        String datasheet,
        String name,
        WeaponType weaponType,
        String range,
        String a,
        String skill,
        String s,
        String ap,
        String d,
        List<KeywordRef> abilities)
        implements GameEntity {

    public Weapon {
        abilities = abilities == null ? List.of() : List.copyOf(abilities);
    }

    @Override
    public EntityType type() {
        return EntityType.WEAPON;
    }

    @Override
    public Optional<String> parentKey() {
        return Optional.of(datasheet);
    }
}
