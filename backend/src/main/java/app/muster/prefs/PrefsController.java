package app.muster.prefs;

import app.muster.auth.AuthUser;
import app.muster.auth.CurrentUser;
import app.muster.common.ApiException;
import app.muster.gamedata.build.GameJson;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Per-user UI preferences (pane sizes, last opened roster): a small JSON object. */
@RestController
@RequestMapping("/api/me/prefs")
public class PrefsController {

    private static final int MAX_BYTES = 16 * 1024;

    private final JdbcClient jdbc;

    public PrefsController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public JsonNode get(@CurrentUser AuthUser me) {
        return jdbc.sql("SELECT prefs FROM user_prefs WHERE user_id = ?")
                .param(me.id())
                .query(String.class)
                .optional()
                .map(GameJson::read)
                .orElseGet(GameJson.MAPPER::createObjectNode);
    }

    @PutMapping
    public JsonNode put(@CurrentUser AuthUser me, @RequestBody JsonNode prefs) {
        if (prefs == null || !prefs.isObject()) throw ApiException.badRequest("BAD_PREFS", "Preferences must be a JSON object");
        String json = GameJson.write(prefs);
        if (json.length() > MAX_BYTES) throw ApiException.badRequest("BAD_PREFS", "Preferences are too large");
        jdbc.sql("""
                        INSERT INTO user_prefs (user_id, prefs) VALUES (?, ?::jsonb)
                        ON CONFLICT (user_id) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()
                        """)
                .params(me.id(), json)
                .update();
        return prefs;
    }
}
