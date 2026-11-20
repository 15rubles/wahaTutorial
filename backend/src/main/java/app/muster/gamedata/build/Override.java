package app.muster.gamedata.build;

import app.muster.gamedata.model.EntityType;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * A manual fix. {@code field} is a dotted path into the entity data ("points", "text.plain",
 * "tags"), or {@code *} with a full JSON object to create or replace the whole entity.
 */
public record Override(long id, EntityType type, String key, String field, JsonNode value, String note) {

    public static final String WHOLE_ENTITY = "*";

    public boolean isWholeEntity() {
        return WHOLE_ENTITY.equals(field);
    }
}
