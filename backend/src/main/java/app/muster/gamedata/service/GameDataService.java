package app.muster.gamedata.service;

import app.muster.common.ApiException;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.store.DataVersionRepository;
import app.muster.gamedata.store.GameEntityRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Read access to game data with a small in-memory cache per (version, faction). Versions are
 * immutable except for overrides, which call {@link #invalidate(long)}.
 */
@Service
public class GameDataService {

    private static final int MAX_CACHED = 24;

    private final DataVersionRepository versions;
    private final GameEntityRepository entities;
    private final Map<String, Object> cache = new LinkedHashMap<>(32, 0.75f, true) {
        @java.lang.Override
        protected boolean removeEldestEntry(Map.Entry<String, Object> eldest) {
            return size() > MAX_CACHED;
        }
    };

    public GameDataService(DataVersionRepository versions, GameEntityRepository entities) {
        this.versions = versions;
        this.entities = entities;
    }

    public Optional<Long> activeVersionId() {
        return versions.activeId();
    }

    public long requireActiveVersion() {
        return activeVersionId().orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "NO_GAME_DATA",
                "No game data has been activated yet. An admin needs to import and activate data first."));
    }

    public CoreData core(long versionId) {
        String key = versionId + "|core";
        synchronized (cache) {
            Object hit = cache.get(key);
            if (hit != null) return (CoreData) hit;
        }
        CoreData core = new CoreData(versionId, entities.core(versionId));
        synchronized (cache) {
            cache.put(key, core);
        }
        return core;
    }

    public FactionData faction(long versionId, String factionKey) {
        String key = versionId + "|f|" + factionKey;
        synchronized (cache) {
            Object hit = cache.get(key);
            if (hit != null) return (FactionData) hit;
        }
        CoreData core = core(versionId);
        List<Faction> lineage = core.lineage(factionKey);
        if (lineage.isEmpty()) throw ApiException.notFound("Faction " + factionKey);
        List<GameEntity> list = entities.forFactions(versionId, lineage.stream().map(Faction::key).toList());
        FactionData data = new FactionData(core, lineage, list);
        synchronized (cache) {
            cache.put(key, data);
        }
        return data;
    }

    /** Factions any army may add when "unaligned" units are shown (allegiance UNALIGNED in the data). */
    public List<FactionData> unaligned(long versionId) {
        return core(versionId).factions().stream()
                .filter(f -> f.allegiance().map(a -> a == app.muster.gamedata.model.Allegiance.UNALIGNED).orElse(false))
                .map(f -> faction(versionId, f.key()))
                .toList();
    }

    public void invalidate(long versionId) {
        synchronized (cache) {
            cache.keySet().removeIf(k -> k.startsWith(versionId + "|"));
        }
    }

    public void invalidateAll() {
        synchronized (cache) {
            cache.clear();
        }
    }
}
