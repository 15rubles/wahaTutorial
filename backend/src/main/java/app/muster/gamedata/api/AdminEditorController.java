package app.muster.gamedata.api;

import app.muster.auth.AuthUser;
import app.muster.auth.CurrentUser;
import app.muster.common.ApiException;
import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.Stratagem;
import app.muster.gamedata.service.GameDataService;
import app.muster.gamedata.service.OverrideService;
import app.muster.gamedata.store.GameEntityRepository;
import app.muster.gamedata.store.OverrideRepository;
import app.muster.gamedata.store.StoredEntity;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Admin data browser / editor, overrides and the phase tag review list (DESIGN.md 4 and 5.4). */
@RestController
@RequestMapping("/api/admin")
@Validated
public class AdminEditorController {

    private final GameDataService gameData;
    private final GameEntityRepository entities;
    private final OverrideRepository overrides;
    private final OverrideService overrideService;

    public AdminEditorController(
            GameDataService gameData, GameEntityRepository entities, OverrideRepository overrides, OverrideService overrideService) {
        this.gameData = gameData;
        this.entities = entities;
        this.overrides = overrides;
        this.overrideService = overrideService;
    }

    private long version(Optional<Long> v) {
        return v.orElseGet(gameData::requireActiveVersion);
    }

    @GetMapping("/entities")
    public List<GameEntityRepository.Listing> list(
            @RequestParam Optional<EntityType> type,
            @RequestParam Optional<@Size(max = 120) String> faction,
            @RequestParam Optional<@Size(max = 100) String> q,
            @RequestParam(defaultValue = "200") @Min(1) @Max(1000) int limit,
            @RequestParam Optional<Long> version) {
        return entities.list(version(version), type, faction, q, limit);
    }

    public record EntityDetail(StoredEntity stored, List<OverrideRepository.Row> overrides) {}

    @GetMapping("/entities/{type}/{key}")
    public EntityDetail get(@PathVariable EntityType type, @PathVariable String key, @RequestParam Optional<Long> version) {
        StoredEntity s = entities.find(version(version), type, key).orElseThrow(() -> ApiException.notFound(type + " " + key));
        return new EntityDetail(s, overrides.forEntity(type, key));
    }

    public record OverrideRequest(
            @NotNull EntityType type,
            @NotBlank @Size(max = 300) String key,
            @NotBlank @Size(max = 100) String field,
            @NotNull JsonNode value,
            @Size(max = 2000) String note) {}

    @GetMapping("/overrides")
    public List<OverrideRepository.Row> listOverrides() {
        return overrides.all();
    }

    @PutMapping("/overrides")
    public List<OverrideRepository.Row> putOverrides(@CurrentUser AuthUser me, @RequestBody @Size(min = 1, max = 500) List<@Valid OverrideRequest> body) {
        overrideService.save(body.stream().map(r -> new OverrideService.Edit(r.type(), r.key(), r.field(), r.value(), r.note())).toList(),
                Optional.of(me.id()));
        return overrides.all();
    }

    @DeleteMapping("/overrides/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOverride(@PathVariable long id) {
        overrideService.delete(id);
    }

    public record ReviewItem(
            EntityType type, String key, String name, Optional<String> faction, PhaseTags tags, String text) {}

    public record ReviewPage(int total, int offset, List<ReviewItem> items) {}

    /** Every ability, enhancement and stratagem whose phase tags are inferred or empty and not confirmed. */
    @GetMapping("/review/phase-tags")
    public ReviewPage phaseTags(
            @RequestParam Optional<String> faction,
            @RequestParam Optional<EntityType> type,
            @RequestParam(defaultValue = "all") String state,
            @RequestParam(defaultValue = "0") @Min(0) int offset,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit,
            @RequestParam Optional<Long> version) {
        long v = version(version);
        List<ReviewItem> all = new java.util.ArrayList<>();
        for (EntityType t : List.of(EntityType.STRATAGEM, EntityType.ENHANCEMENT, EntityType.ABILITY)) {
            if (type.isPresent() && type.get() != t) continue;
            for (GameEntity e : entities.byType(v, t, t.recordType())) {
                if (faction.isPresent() && !e.factionKey().map(faction.get()::equals).orElse(false)) continue;
                ReviewItem item = switch (e) {
                    case Ability a -> new ReviewItem(t, a.key(), a.name(), a.faction(), a.tags(), a.text().plain());
                    case Enhancement en -> new ReviewItem(t, en.key(), en.name(), Optional.of(en.faction()), en.tags(), en.text().plain());
                    case Stratagem s -> new ReviewItem(t, s.key(), s.name(), s.faction(), s.tags(),
                            s.when().isBlank() ? s.fullText().plain() : "WHEN: " + s.when().plain() + "\nEFFECT: " + s.effect().plain());
                    default -> null;
                };
                if (item == null || !item.tags().needsReview()) continue;
                boolean inferred = item.tags().inferred();
                if (state.equals("inferred") && !inferred) continue;
                if (state.equals("empty") && !item.tags().isEmpty()) continue;
                all.add(item);
            }
        }
        all.sort(Comparator.comparing((ReviewItem i) -> i.faction().orElse("")).thenComparing(i -> i.type().ordinal())
                .thenComparing(i -> i.name().toLowerCase(Locale.ROOT)));
        int from = Math.min(offset, all.size());
        int to = Math.min(all.size(), from + limit);
        return new ReviewPage(all.size(), from, all.subList(from, to));
    }

    public record ConfirmRequest(@NotNull EntityType type, @NotBlank String key, @NotNull PhaseTags tags) {}

    /** Confirms (or corrects) phase tags in bulk; stored as overrides with confirmed = true. */
    @PostMapping("/review/phase-tags/confirm")
    public void confirm(@CurrentUser AuthUser me, @RequestBody @Size(min = 1, max = 200) List<@Valid ConfirmRequest> body) {
        overrideService.save(body.stream()
                        .map(r -> new OverrideService.Edit(r.type(), r.key(), "tags",
                                app.muster.gamedata.build.GameJson.MAPPER.valueToTree(new PhaseTags(r.tags().phases(), r.tags().timing(), r.tags().inferred(), true)),
                                "Phase tags reviewed"))
                        .toList(),
                Optional.of(me.id()));
    }
}
