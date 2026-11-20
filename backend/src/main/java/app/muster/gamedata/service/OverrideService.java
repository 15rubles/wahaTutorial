package app.muster.gamedata.service;

import app.muster.common.ApiException;
import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.Override;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.store.GameEntityRepository;
import app.muster.gamedata.store.OverrideRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Stores manual fixes (validated against the current data) and re-applies them to the live versions. */
@Service
public class OverrideService {

    private static final Pattern FIELD = Pattern.compile("^(\\*|[A-Za-z][A-Za-z0-9]*(\\.[A-Za-z][A-Za-z0-9]*){0,3})$");

    private final OverrideRepository overrides;
    private final GameEntityRepository entities;
    private final GameDataService gameData;
    private final DataPipelineService pipeline;

    public OverrideService(OverrideRepository overrides, GameEntityRepository entities, GameDataService gameData, DataPipelineService pipeline) {
        this.overrides = overrides;
        this.entities = entities;
        this.gameData = gameData;
        this.pipeline = pipeline;
    }

    public record Edit(EntityType type, String key, String field, JsonNode value, String note) {}

    @Transactional
    public void save(List<Edit> edits, Optional<Long> userId) {
        if (edits.isEmpty()) return;
        for (Edit e : edits) {
            validate(e);
            overrides.upsert(e.type(), e.key(), e.field(), e.value(), e.note() == null ? "" : e.note().trim(), userId);
        }
        pipeline.reapplyOverrides();
    }

    @Transactional
    public void delete(long id) {
        if (!overrides.delete(id)) throw ApiException.notFound("Override");
        pipeline.reapplyOverrides();
    }

    /** Applies the edit to the entity as it is now and checks the result still is a valid record. */
    void validate(Edit e) {
        if (e.key() == null || e.key().isBlank() || e.key().length() > 300) throw ApiException.badRequest("BAD_KEY", "A key is required");
        if (e.field() == null || !FIELD.matcher(e.field()).matches()) throw ApiException.badRequest("BAD_FIELD", "Not a valid field path: " + e.field());
        if (e.field().equals("key")) throw ApiException.badRequest("BAD_FIELD", "The key cannot be changed");
        if (e.value() == null) throw ApiException.badRequest("BAD_VALUE", "A value is required");
        ObjectNode base;
        if (e.field().equals(Override.WHOLE_ENTITY)) {
            if (!e.value().isObject()) throw ApiException.badRequest("BAD_VALUE", "A whole entity must be a JSON object");
            base = ((ObjectNode) e.value()).deepCopy();
            base.put("key", e.key());
        } else {
            long version = gameData.activeVersionId()
                    .or(() -> Optional.empty())
                    .orElseThrow(() -> ApiException.badRequest("NO_GAME_DATA", "Activate a data version before editing it"));
            GameEntity current = entities.find(version, e.type(), e.key())
                    .map(s -> s.entity())
                    .orElseThrow(() -> ApiException.notFound(e.type() + " " + e.key()));
            base = GameJson.toNode(current);
            if (!setPath(base, e.field(), e.value())) throw ApiException.badRequest("BAD_FIELD", "Field " + e.field() + " does not fit");
        }
        try {
            GameEntity parsed = GameJson.fromNode(base, e.type());
            if (parsed.name() == null || parsed.name().isBlank()) throw new IllegalArgumentException("name is required");
        } catch (RuntimeException ex) {
            throw ApiException.badRequest("INVALID_OVERRIDE", "The value does not fit " + e.type() + ": " + ex.getMessage());
        }
    }

    private static boolean setPath(ObjectNode root, String path, JsonNode value) {
        String[] parts = path.split("\\.");
        ObjectNode node = root;
        for (int i = 0; i < parts.length - 1; i++) {
            JsonNode next = node.get(parts[i]);
            if (next == null || next.isNull()) next = node.putObject(parts[i]);
            if (!next.isObject()) return false;
            node = (ObjectNode) next;
        }
        node.set(parts[parts.length - 1], value);
        return true;
    }
}
