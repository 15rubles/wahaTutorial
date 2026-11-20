package app.muster.gamedata.build;

import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.Source;
import java.util.Map;

/** One merged, validated entity ready to be stored in a data version. */
public record BuiltEntity(
        GameEntity entity, Source source, Map<String, Source> provenance, Map<Source, String> externalIds) {

    public EntityType type() {
        return entity.type();
    }

    public String key() {
        return entity.key();
    }
}
