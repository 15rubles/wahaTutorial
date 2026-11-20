package app.muster.export;

import app.muster.auth.AuthUser;
import app.muster.auth.CurrentUser;
import app.muster.common.ApiException;
import app.muster.gamedata.build.GameJson;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ExportController {

    private static final int MAX_SETTINGS = 8 * 1024;
    private static final int MAX_PRESETS = 50;

    private final ExportService exports;
    private final JdbcClient jdbc;

    public ExportController(ExportService exports, JdbcClient jdbc) {
        this.exports = exports;
        this.jdbc = jdbc;
    }

    @GetMapping("/api/rosters/{id}/export-data")
    public ExportData exportData(@CurrentUser AuthUser me, @PathVariable long id) {
        return exports.export(id, me.id());
    }

    public record Preset(long id, String name, JsonNode settings, Instant updatedAt) {}

    public record PresetInput(@NotBlank @Size(max = 100) String name, @NotNull JsonNode settings) {}

    @GetMapping("/api/me/export-presets")
    public List<Preset> presets(@CurrentUser AuthUser me) {
        return jdbc.sql("SELECT id, name, settings, updated_at FROM export_preset WHERE owner_id = ? ORDER BY lower(name)")
                .param(me.id())
                .query((rs, i) -> new Preset(rs.getLong(1), rs.getString(2), GameJson.read(rs.getString(3)), rs.getTimestamp(4).toInstant()))
                .list();
    }

    /** Creates a preset, or replaces the settings of the user's preset with the same name. */
    @PostMapping("/api/me/export-presets")
    @ResponseStatus(HttpStatus.CREATED)
    public Preset save(@CurrentUser AuthUser me, @Valid @RequestBody PresetInput in) {
        if (!in.settings().isObject()) throw ApiException.badRequest("BAD_SETTINGS", "Settings must be a JSON object");
        String json = GameJson.write(in.settings());
        if (json.length() > MAX_SETTINGS) throw ApiException.badRequest("BAD_SETTINGS", "Settings are too large");
        int count = jdbc.sql("SELECT count(*) FROM export_preset WHERE owner_id = ?").param(me.id()).query(Integer.class).single();
        if (count >= MAX_PRESETS) throw ApiException.badRequest("TOO_MANY_PRESETS", "You can keep up to " + MAX_PRESETS + " presets");
        return jdbc.sql("""
                        INSERT INTO export_preset (owner_id, name, settings) VALUES (?, ?, ?::jsonb)
                        ON CONFLICT (owner_id, name) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()
                        RETURNING id, name, settings, updated_at
                        """)
                .params(me.id(), in.name().trim(), json)
                .query((rs, i) -> new Preset(rs.getLong(1), rs.getString(2), GameJson.read(rs.getString(3)), rs.getTimestamp(4).toInstant()))
                .single();
    }

    @DeleteMapping("/api/me/export-presets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@CurrentUser AuthUser me, @PathVariable long id) {
        if (jdbc.sql("DELETE FROM export_preset WHERE id = ? AND owner_id = ?").params(id, me.id()).update() == 0) {
            throw ApiException.notFound("Preset");
        }
    }
}
