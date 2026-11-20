package app.muster.gamedata.service;

import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.ArmyRule;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.FactionOption;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.Stratagem;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.model.Weapon;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Everything one army needs from one data version: its faction (and parent factions, so a chapter
 * also sees the shared units), plus the core data.
 */
public final class FactionData {

    private final CoreData core;
    private final List<Faction> lineage;
    private final Map<String, Datasheet> datasheets = new LinkedHashMap<>();
    private final Map<String, List<UnitSizeOption>> sizes = new LinkedHashMap<>();
    private final Map<String, List<Weapon>> weapons = new LinkedHashMap<>();
    private final Map<String, List<Ability>> abilitiesByOwner = new LinkedHashMap<>();
    private final Map<String, List<WargearOption>> wargear = new LinkedHashMap<>();
    private final Map<String, Detachment> detachments = new LinkedHashMap<>();
    private final Map<String, Enhancement> enhancements = new LinkedHashMap<>();
    private final List<Stratagem> stratagems = new ArrayList<>();
    private final List<ArmyRule> armyRules = new ArrayList<>();
    private final List<FactionOption> factionOptions = new ArrayList<>();

    FactionData(CoreData core, List<Faction> lineage, List<GameEntity> entities) {
        this.core = core;
        this.lineage = List.copyOf(lineage);
        for (GameEntity e : entities) {
            switch (e) {
                case Datasheet d -> datasheets.putIfAbsent(d.key(), d);
                case UnitSizeOption u -> sizes.computeIfAbsent(u.datasheet(), k -> new ArrayList<>()).add(u);
                case Weapon w -> weapons.computeIfAbsent(w.datasheet(), k -> new ArrayList<>()).add(w);
                case Ability a -> abilitiesByOwner.computeIfAbsent(a.ownerKey(), k -> new ArrayList<>()).add(a);
                case WargearOption o -> wargear.computeIfAbsent(o.datasheet(), k -> new ArrayList<>()).add(o);
                case Detachment d -> detachments.putIfAbsent(d.key(), d);
                case Enhancement en -> enhancements.putIfAbsent(en.key(), en);
                case Stratagem s -> stratagems.add(s);
                case ArmyRule r -> armyRules.add(r);
                case FactionOption o -> factionOptions.add(o);
                default -> {}
            }
        }
        sizes.values().forEach(l -> l.sort(Comparator.comparingInt(UnitSizeOption::models)));
    }

    public CoreData core() {
        return core;
    }

    public long versionId() {
        return core.versionId();
    }

    public Faction faction() {
        return lineage.get(0);
    }

    public List<Faction> lineage() {
        return lineage;
    }

    public List<Datasheet> datasheets() {
        return datasheets.values().stream().sorted(Comparator.comparing(Datasheet::name)).toList();
    }

    public Optional<Datasheet> datasheet(String key) {
        return Optional.ofNullable(datasheets.get(key));
    }

    public List<UnitSizeOption> sizes(String datasheetKey) {
        return sizes.getOrDefault(datasheetKey, List.of());
    }

    public Optional<UnitSizeOption> size(String datasheetKey, String sizeKey) {
        return sizes(datasheetKey).stream().filter(s -> s.key().equals(sizeKey)).findFirst();
    }

    public List<Weapon> weapons(String datasheetKey) {
        return weapons.getOrDefault(datasheetKey, List.of());
    }

    public List<Ability> abilities(String ownerKey) {
        return abilitiesByOwner.getOrDefault(ownerKey, List.of());
    }

    public List<WargearOption> wargear(String datasheetKey) {
        return wargear.getOrDefault(datasheetKey, List.of());
    }

    public List<Detachment> detachments() {
        return detachments.values().stream().sorted(Comparator.comparing(Detachment::name)).toList();
    }

    public Optional<Detachment> detachment(String key) {
        return Optional.ofNullable(detachments.get(key));
    }

    public List<Enhancement> enhancements(String detachmentKey) {
        return enhancements.values().stream().filter(e -> e.detachment().equals(detachmentKey)).toList();
    }

    public Optional<Enhancement> enhancement(String key) {
        return Optional.ofNullable(enhancements.get(key));
    }

    public List<Stratagem> stratagems(String detachmentKey) {
        return stratagems.stream().filter(s -> s.detachment().map(detachmentKey::equals).orElse(false)).toList();
    }

    public List<Stratagem> allFactionStratagems() {
        return List.copyOf(stratagems);
    }

    public List<ArmyRule> armyRules() {
        return List.copyOf(armyRules);
    }

    public List<FactionOption> factionOptions() {
        return List.copyOf(factionOptions);
    }

    public Optional<FactionOption> factionOption(String key) {
        return factionOptions.stream().filter(o -> o.key().equals(key)).findFirst();
    }
}
