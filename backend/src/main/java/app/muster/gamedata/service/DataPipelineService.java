package app.muster.gamedata.service;

import app.muster.common.ApiException;
import app.muster.gamedata.build.BuiltEntity;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.build.VersionBuilder;
import app.muster.gamedata.build.VersionReport;
import app.muster.gamedata.model.DataVersionStatus;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.Source;
import app.muster.gamedata.store.DataVersionRepository;
import app.muster.gamedata.store.DataVersionRow;
import app.muster.gamedata.store.GameEntityRepository;
import app.muster.gamedata.store.OverrideRepository;
import app.muster.gamedata.store.SourceImportRepository;
import java.time.Clock;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Import -> source set -> DRAFT version -> report -> activate (DESIGN.md 5.3). */
@Service
public class DataPipelineService {

    private static final Logger log = LoggerFactory.getLogger(DataPipelineService.class);

    private final SourceImportRepository imports;
    private final DataVersionRepository versions;
    private final GameEntityRepository entities;
    private final OverrideRepository overrides;
    private final GameDataService gameData;
    private final JdbcClient jdbc;
    private final Clock clock;

    public DataPipelineService(
            SourceImportRepository imports,
            DataVersionRepository versions,
            GameEntityRepository entities,
            OverrideRepository overrides,
            GameDataService gameData,
            JdbcClient jdbc,
            Clock clock) {
        this.imports = imports;
        this.versions = versions;
        this.entities = entities;
        this.overrides = overrides;
        this.gameData = gameData;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public record DraftResult(long versionId, long importId, VersionReport report) {}

    /** Stores a parsed import and builds a new DRAFT version from it plus the latest of the other sources. */
    @Transactional
    public DraftResult importAndBuild(SourceSet set, List<String> files, Optional<Long> userId) {
        lock();
        long importId = imports.save(set, files, userId);
        log.info("Stored {} import {} ({} items)", set.source(), importId, set.items().size());
        long versionId = buildDraft(userId);
        return new DraftResult(versionId, importId, versions.report(versionId).orElse(VersionReport.EMPTY));
    }

    /** Builds a DRAFT version from the latest import of each source and all overrides. */
    @Transactional
    public long buildDraft(Optional<Long> userId) {
        lock();
        Map<Source, Long> ids = imports.latestIds();
        if (ids.isEmpty()) throw ApiException.badRequest("NO_IMPORTS", "Nothing has been imported yet");
        Map<Source, SourceSet> sets = new EnumMap<>(Source.class);
        ids.forEach((s, id) -> sets.put(s, imports.load(id).orElseThrow()));
        Optional<VersionBuilder.PreviousVersion> previous = versions.activeId().map(this::snapshot);
        VersionBuilder.Result result = VersionBuilder.build(new VersionBuilder.Input(sets, ids, overrides.allAsOverrides(), previous));
        List<String> files = new ArrayList<>();
        imports.list().stream().filter(s -> ids.containsValue(s.id())).forEach(s -> files.addAll(s.files()));
        Map<String, Long> idNames = new HashMap<>();
        ids.forEach((s, id) -> idNames.put(s.name(), id));
        long versionId = versions.create(userId, files, idNames, result.report());
        entities.insertAll(versionId, result.entities());
        log.info("Built draft data version {} with {} entities", versionId, result.entities().size());
        return versionId;
    }

    @Transactional
    public DataVersionRow activate(long versionId) {
        lock();
        DataVersionRow v = versions.find(versionId).orElseThrow(() -> ApiException.notFound("Data version"));
        if (v.status() == DataVersionStatus.ACTIVE) return v;
        versions.activate(versionId, clock.instant());
        gameData.invalidateAll();
        log.info("Activated data version {}", versionId);
        return versions.find(versionId).orElseThrow();
    }

    /**
     * Rebuilds the content of the active and draft versions in place from their own imports plus the
     * current overrides. Rosters reference stable keys, so replacing rows is safe.
     */
    @Transactional
    public void reapplyOverrides() {
        lock();
        for (long versionId : versions.liveIds()) {
            DataVersionRow v = versions.find(versionId).orElseThrow();
            Map<Source, SourceSet> sets = new EnumMap<>(Source.class);
            Map<Source, Long> ids = new EnumMap<>(Source.class);
            v.importIds().forEach((s, id) -> {
                imports.load(id).ifPresent(set -> sets.put(Source.valueOf(s), set));
                ids.put(Source.valueOf(s), id);
            });
            if (sets.isEmpty()) continue;
            VersionReport old = versions.report(versionId).orElse(VersionReport.EMPTY);
            VersionBuilder.Result r = VersionBuilder.build(new VersionBuilder.Input(sets, ids, overrides.allAsOverrides(), Optional.empty()));
            entities.deleteVersionContent(versionId);
            entities.insertAll(versionId, r.entities());
            versions.updateReport(versionId, new VersionReport(r.report().sourceImports(), r.report().counts(), r.report().issues(),
                    old.diff(), r.report().phaseTagsToReview(), r.report().overridesApplied()));
            gameData.invalidate(versionId);
        }
    }

    private VersionBuilder.PreviousVersion snapshot(long versionId) {
        Map<String, GameEntity> map = new HashMap<>();
        for (GameEntity e : entities.all(versionId)) map.put(e.type() + "|" + e.key(), e);
        return new VersionBuilder.PreviousVersion(versionId, map);
    }

    /** Serializes data pipeline work across app instances and requests. */
    private void lock() {
        jdbc.sql("SELECT pg_advisory_xact_lock(4711)").query().singleRow();
    }

}
