package app.muster.gamedata.store;

import app.muster.gamedata.build.BuiltEntity;
import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.Source;
import com.fasterxml.jackson.core.type.TypeReference;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class GameEntityRepository {

    private static final int BATCH = 1000;
    private static final String COLUMNS = "type, data, source, provenance, external_ids";

    private final JdbcClient jdbc;
    private final JdbcTemplate template;

    public GameEntityRepository(JdbcClient jdbc, JdbcTemplate template) {
        this.jdbc = jdbc;
        this.template = template;
    }

    public void insertAll(long versionId, List<BuiltEntity> entities) {
        String sql = """
                INSERT INTO game_entity (data_version_id, type, key, faction_key, parent_key, name, source, provenance, external_ids, data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb)
                """;
        for (int from = 0; from < entities.size(); from += BATCH) {
            List<BuiltEntity> chunk = entities.subList(from, Math.min(entities.size(), from + BATCH));
            template.batchUpdate(sql, chunk, chunk.size(), (PreparedStatement ps, BuiltEntity b) -> {
                GameEntity e = b.entity();
                ps.setLong(1, versionId);
                ps.setString(2, e.type().name());
                ps.setString(3, e.key());
                ps.setString(4, e.factionKey().orElse(null));
                ps.setString(5, e.parentKey().orElse(null));
                ps.setString(6, truncate(e.name(), 300));
                ps.setString(7, b.source().name());
                ps.setString(8, GameJson.write(b.provenance()));
                ps.setString(9, GameJson.write(b.externalIds()));
                ps.setString(10, GameJson.write(e));
            });
        }
    }

    public void deleteVersionContent(long versionId) {
        jdbc.sql("DELETE FROM game_entity WHERE data_version_id = ?").param(versionId).update();
    }

    public List<GameEntity> all(long versionId) {
        return jdbc.sql("SELECT type, data FROM game_entity WHERE data_version_id = ? ORDER BY id")
                .param(versionId)
                .query(this::entity)
                .list();
    }

    /** All entities of a faction and the faction-less core data (glossary, battle sizes, core stratagems). */
    public List<GameEntity> forFactions(long versionId, List<String> factionKeys) {
        return jdbc.sql("""
                        SELECT type, data FROM game_entity WHERE data_version_id = :v
                        AND (faction_key IN (:f) OR parent_key IN (SELECT key FROM game_entity WHERE data_version_id = :v
                             AND type IN ('DATASHEET', 'DETACHMENT') AND faction_key IN (:f)))
                        ORDER BY id
                        """)
                .param("v", versionId)
                .param("f", factionKeys.isEmpty() ? List.of("") : factionKeys)
                .query(this::entity)
                .list();
    }

    public List<GameEntity> core(long versionId) {
        return jdbc.sql("""
                        SELECT type, data FROM game_entity WHERE data_version_id = ?
                        AND ((faction_key IS NULL AND parent_key IS NULL) OR type = 'FACTION')
                        ORDER BY id
                        """)
                .param(versionId)
                .query(this::entity)
                .list();
    }

    public <T extends GameEntity> List<T> byType(long versionId, EntityType type, Class<T> cls) {
        return jdbc.sql("SELECT type, data FROM game_entity WHERE data_version_id = ? AND type = ? ORDER BY lower(name)")
                .params(versionId, type.name())
                .query(this::entity)
                .list()
                .stream()
                .map(cls::cast)
                .toList();
    }

    public Optional<StoredEntity> find(long versionId, EntityType type, String key) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM game_entity WHERE data_version_id = ? AND type = ? AND key = ?")
                .params(versionId, type.name(), key)
                .query(this::stored)
                .optional();
    }

    public record Listing(EntityType type, String key, String name, Optional<String> faction, Optional<String> parent, Source source) {}

    /** Light listing for the admin data browser. */
    public List<Listing> list(long versionId, Optional<EntityType> type, Optional<String> faction, Optional<String> q, int limit) {
        StringBuilder sql = new StringBuilder("SELECT type, key, name, faction_key, parent_key, source FROM game_entity WHERE data_version_id = :v");
        Map<String, Object> params = new java.util.HashMap<>();
        params.put("v", versionId);
        type.ifPresent(t -> {
            sql.append(" AND type = :t");
            params.put("t", t.name());
        });
        faction.ifPresent(f -> {
            sql.append(" AND (faction_key = :f OR parent_key IN (SELECT key FROM game_entity WHERE data_version_id = :v AND faction_key = :f))");
            params.put("f", f);
        });
        q.filter(s -> !s.isBlank()).ifPresent(s -> {
            sql.append(" AND (lower(name) LIKE :q OR lower(key) LIKE :q)");
            params.put("q", "%" + s.toLowerCase().replace("%", "").replace("_", "") + "%");
        });
        sql.append(" ORDER BY type, lower(name) LIMIT :limit");
        params.put("limit", limit);
        return jdbc.sql(sql.toString())
                .params(params)
                .query((rs, i) -> new Listing(
                        EntityType.valueOf(rs.getString(1)),
                        rs.getString(2),
                        rs.getString(3),
                        Optional.ofNullable(rs.getString(4)),
                        Optional.ofNullable(rs.getString(5)),
                        Source.valueOf(rs.getString(6))))
                .list();
    }

    private GameEntity entity(ResultSet rs, int i) throws SQLException {
        return GameJson.fromNode(GameJson.read(rs.getString("data")), EntityType.valueOf(rs.getString("type")));
    }

    private StoredEntity stored(ResultSet rs, int i) throws SQLException {
        return new StoredEntity(
                entity(rs, i),
                Source.valueOf(rs.getString("source")),
                GameJson.MAPPER.convertValue(GameJson.read(rs.getString("provenance")), new TypeReference<Map<String, Source>>() {}),
                GameJson.MAPPER.convertValue(GameJson.read(rs.getString("external_ids")), new TypeReference<Map<Source, String>>() {}));
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

}
