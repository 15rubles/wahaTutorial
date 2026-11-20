package app.muster.gamedata.service;

import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.ForceDisposition;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.Stratagem;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Faction-independent data of one version: factions, glossary, battle sizes, dispositions, core stratagems. */
public final class CoreData {

    private final long versionId;
    private final Map<String, Faction> factions = new LinkedHashMap<>();
    private final Map<String, GlossaryEntry> glossary = new LinkedHashMap<>();
    private final Map<String, BattleSize> battleSizes = new LinkedHashMap<>();
    private final Map<String, ForceDisposition> forceDispositions = new LinkedHashMap<>();
    private final List<Stratagem> coreStratagems = new ArrayList<>();

    CoreData(long versionId, List<GameEntity> entities) {
        this.versionId = versionId;
        for (GameEntity e : entities) {
            switch (e) {
                case Faction f -> factions.put(f.key(), f);
                case GlossaryEntry g -> glossary.put(g.key(), g);
                case BattleSize b -> battleSizes.put(b.key(), b);
                case ForceDisposition fd -> forceDispositions.put(fd.key(), fd);
                case Stratagem s when s.isCore() -> coreStratagems.add(s);
                default -> {}
            }
        }
    }

    public long versionId() {
        return versionId;
    }

    public List<Faction> factions() {
        return factions.values().stream().sorted(Comparator.comparing(Faction::name)).toList();
    }

    public Optional<Faction> faction(String key) {
        return Optional.ofNullable(factions.get(key));
    }

    /** The faction and its parents, closest first (Blood Angels, then Space Marines). */
    public List<Faction> lineage(String key) {
        List<Faction> out = new ArrayList<>();
        Optional<Faction> f = faction(key);
        while (f.isPresent() && out.size() < 5 && !out.contains(f.get())) {
            out.add(f.get());
            f = f.get().parentKey().flatMap(this::faction);
        }
        return out;
    }

    public Map<String, GlossaryEntry> glossary() {
        return glossary;
    }

    public Optional<GlossaryEntry> glossary(String key) {
        return Optional.ofNullable(glossary.get(key));
    }

    public List<BattleSize> battleSizes() {
        return battleSizes.values().stream()
                .sorted(Comparator.comparing((BattleSize b) -> b.pointsLimit().orElse(Integer.MAX_VALUE)).thenComparing(BattleSize::name))
                .toList();
    }

    public Optional<BattleSize> battleSize(String key) {
        return Optional.ofNullable(battleSizes.get(key));
    }

    public List<ForceDisposition> forceDispositions() {
        return List.copyOf(forceDispositions.values());
    }

    public Optional<ForceDisposition> forceDisposition(String key) {
        return Optional.ofNullable(forceDispositions.get(key));
    }

    public List<Stratagem> coreStratagems() {
        return List.copyOf(coreStratagems);
    }
}
