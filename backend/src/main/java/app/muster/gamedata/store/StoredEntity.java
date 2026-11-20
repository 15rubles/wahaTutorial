package app.muster.gamedata.store;

import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.Source;
import java.util.Map;

/** A game entity as stored in a data version, with where its fields came from. */
public record StoredEntity(GameEntity entity, Source source, Map<String, Source> provenance, Map<Source, String> externalIds) {}
