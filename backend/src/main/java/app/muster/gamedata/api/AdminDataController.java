package app.muster.gamedata.api;

import app.muster.auth.AuthUser;
import app.muster.auth.CurrentUser;
import app.muster.common.ApiException;
import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.build.VersionReport;
import app.muster.gamedata.importer.battlescribe.BattleScribeImporter;
import app.muster.gamedata.service.DataPipelineService;
import app.muster.gamedata.store.DataVersionRepository;
import app.muster.gamedata.store.DataVersionRow;
import app.muster.gamedata.store.SourceImportRepository;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin")
public class AdminDataController {

    private final BattleScribeImporter battleScribe;
    private final DataPipelineService pipeline;
    private final DataVersionRepository versions;
    private final SourceImportRepository imports;

    public AdminDataController(
            BattleScribeImporter battleScribe,
            DataPipelineService pipeline,
            DataVersionRepository versions,
            SourceImportRepository imports) {
        this.battleScribe = battleScribe;
        this.pipeline = pipeline;
        this.versions = versions;
        this.imports = imports;
    }

    public record ImportResult(long versionId, long importId, VersionSummary version) {}

    public record VersionSummary(DataVersionRow version, int entities, int errors, int warnings, int phaseTagsToReview) {

        static VersionSummary of(DataVersionRow row, VersionReport r) {
            int entities = r.counts().values().stream().flatMap(m -> m.values().stream()).mapToInt(Integer::intValue).sum();
            long errors = r.issues().stream().filter(i -> i.level() == ImportReport.Level.ERROR).count();
            long warnings = r.issues().stream().filter(i -> i.level() == ImportReport.Level.WARNING).count();
            return new VersionSummary(row, entities, (int) errors, (int) warnings, r.phaseTagsToReview());
        }
    }

    static byte[] bytes(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("FILE_REQUIRED", "Choose a file to upload");
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw ApiException.badRequest("UPLOAD_FAILED", "Could not read the upload");
        }
    }

    static String fileName(MultipartFile file) {
        String n = Optional.ofNullable(file.getOriginalFilename()).orElse("upload");
        return n.replaceAll("[^A-Za-z0-9._ -]", "_");
    }

    @PostMapping("/imports/battlescribe")
    @ResponseStatus(HttpStatus.CREATED)
    public ImportResult importBattleScribe(@CurrentUser AuthUser me, @RequestParam("file") MultipartFile file) {
        SourceSet set = battleScribe.importZip(bytes(file));
        return finish(pipeline.importAndBuild(set, List.of(fileName(file)), Optional.of(me.id())));
    }

    ImportResult finish(DataPipelineService.DraftResult r) {
        DataVersionRow row = versions.find(r.versionId()).orElseThrow();
        return new ImportResult(r.versionId(), r.importId(), VersionSummary.of(row, r.report()));
    }

    @GetMapping("/imports")
    public List<SourceImportRepository.Summary> listImports() {
        return imports.list();
    }

    @GetMapping("/data-versions")
    public List<VersionSummary> listVersions() {
        return versions.list().stream()
                .map(v -> VersionSummary.of(v, versions.report(v.id()).orElse(VersionReport.EMPTY)))
                .toList();
    }

    @GetMapping("/data-versions/{id}/report")
    public VersionReport report(@PathVariable long id) {
        return versions.report(id).orElseThrow(() -> ApiException.notFound("Data version"));
    }

    @PostMapping("/data-versions/{id}/activate")
    public VersionSummary activate(@PathVariable long id) {
        DataVersionRow row = pipeline.activate(id);
        return VersionSummary.of(row, versions.report(id).orElse(VersionReport.EMPTY));
    }

    @PostMapping("/data-versions/rebuild")
    @ResponseStatus(HttpStatus.CREATED)
    public VersionSummary rebuild(@CurrentUser AuthUser me) {
        long id = pipeline.buildDraft(Optional.of(me.id()));
        return VersionSummary.of(versions.find(id).orElseThrow(), versions.report(id).orElse(VersionReport.EMPTY));
    }
}
