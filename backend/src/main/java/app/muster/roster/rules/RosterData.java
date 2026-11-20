package app.muster.roster.rules;

import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.service.FactionData;
import app.muster.roster.model.RosterSnapshot;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * The game data a roster is checked against: its faction lineage plus the unaligned factions the
 * roster's flags allow.
 */
public record RosterData(FactionData faction, List<FactionData> unaligned) {

    public RosterData {
        unaligned = unaligned == null ? List.of() : List.copyOf(unaligned);
    }

    public static RosterData of(FactionData faction) {
        return new RosterData(faction, List.of());
    }

    public Optional<Datasheet> datasheet(String key) {
        return faction.datasheet(key).or(() -> unaligned.stream().map(u -> u.datasheet(key)).flatMap(Optional::stream).findFirst());
    }

    /** True when the datasheet belongs to the army's own faction lineage (not an unaligned extra). */
    public boolean isNative(String datasheetKey) {
        return faction.datasheet(datasheetKey).isPresent();
    }

    private FactionData owner(String datasheetKey) {
        if (faction.datasheet(datasheetKey).isPresent()) return faction;
        return unaligned.stream().filter(u -> u.datasheet(datasheetKey).isPresent()).findFirst().orElse(faction);
    }

    public List<UnitSizeOption> sizes(String datasheetKey) {
        return owner(datasheetKey).sizes(datasheetKey);
    }

    public Optional<UnitSizeOption> size(String datasheetKey, String sizeKey) {
        return owner(datasheetKey).size(datasheetKey, sizeKey);
    }

    public List<WargearOption> wargear(String datasheetKey) {
        return owner(datasheetKey).wargear(datasheetKey);
    }

    public Optional<Detachment> detachment(String key) {
        return faction.detachment(key);
    }

    public Optional<Enhancement> enhancement(String key) {
        return faction.enhancement(key);
    }

    public Optional<BattleSize> battleSize(RosterSnapshot r) {
        return r.battleSizeKey().flatMap(k -> faction.core().battleSize(k));
    }

    /** Names (and so faction keywords) of the army's faction lineage, closest first. */
    public List<String> factionNames() {
        List<String> out = new ArrayList<>();
        for (Faction f : faction.lineage()) out.add(f.name());
        return out;
    }

    /** DP cost of a detachment for this army (per-keyword costs from the data win). */
    public Optional<Integer> dpCost(Detachment d) {
        for (String name : factionNames()) {
            for (var e : d.dpByKeyword().entrySet()) {
                if (e.getKey().equalsIgnoreCase(name)) return Optional.of(e.getValue());
            }
        }
        return d.dpCost();
    }

    public static boolean hasKeyword(Datasheet d, String keyword) {
        String k = keyword.toLowerCase(Locale.ROOT);
        return d.keywords().stream().anyMatch(x -> x.toLowerCase(Locale.ROOT).equals(k))
                || d.factionKeywords().stream().anyMatch(x -> x.toLowerCase(Locale.ROOT).equals(k));
    }

    public static boolean isCharacter(Datasheet d) {
        return hasKeyword(d, "Character") || d.role().map(r -> r.toLowerCase(Locale.ROOT).contains("character")).orElse(false);
    }

    public static boolean isEpicHero(Datasheet d) {
        return hasKeyword(d, "Epic Hero") || d.role().map(r -> r.toLowerCase(Locale.ROOT).contains("epic hero")).orElse(false);
    }

    public static boolean isBattleline(Datasheet d) {
        return hasKeyword(d, "Battleline") || d.role().map(r -> r.toLowerCase(Locale.ROOT).contains("battleline")).orElse(false);
    }

    public static boolean isDedicatedTransport(Datasheet d) {
        return hasKeyword(d, "Dedicated Transport") || d.role().map(r -> r.toLowerCase(Locale.ROOT).contains("dedicated transport")).orElse(false);
    }

    public static boolean isFortification(Datasheet d) {
        return hasKeyword(d, "Fortification") || d.role().map(r -> r.toLowerCase(Locale.ROOT).contains("fortification")).orElse(false);
    }
}
