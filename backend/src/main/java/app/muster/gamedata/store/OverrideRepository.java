package app.muster.gamedata.store;

import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.Override;
import app.muster.gamedata.model.EntityType;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class OverrideRepository {

    public record Row(
            long id, EntityType type, String key, String field, JsonNode value, String note, Optional<String> createdBy, Instant updatedAt) {

        public Override toOverride() {
            return new Override(id, type, key, field, value, note);
        }
    }

    private final JdbcClient jdbc;

    public OverrideRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Row> all() {
        return jdbc.sql("""
                        SELECT o.id, o.entity_type, o.entity_key, o.field, o.value, o.note, u.username, o.updated_at
                        FROM manual_override o LEFT JOIN app_user u ON u.id = o.created_by ORDER BY o.id
                        """)
                .query((rs, i) -> new Row(
                        rs.getLong(1),
                        EntityType.valueOf(rs.getString(2)),
                        rs.getString(3),
                        rs.getString(4),
                        GameJson.read(rs.getString(5)),
                        rs.getString(6),
                        Optional.ofNullable(rs.getString(7)),
                        rs.getTimestamp(8).toInstant()))
                .list();
    }

    public List<Override> allAsOverrides() {
        return all().stream().map(Row::toOverride).toList();
    }

    public List<Row> forEntity(EntityType type, String key) {
        return all().stream().filter(r -> r.type() == type && r.key().equals(key)).toList();
    }

    public long upsert(EntityType type, String key, String field, JsonNode value, String note, Optional<Long> userId) {
        return jdbc.sql("""
                        INSERT INTO manual_override (entity_type, entity_key, field, value, note, created_by)
                        VALUES (?, ?, ?, ?::jsonb, ?, ?)
                        ON CONFLICT (entity_type, entity_key, field)
                        DO UPDATE SET value = EXCLUDED.value, note = EXCLUDED.note, created_by = EXCLUDED.created_by, updated_at = now()
                        RETURNING id
                        """)
                .params(type.name(), key, field, GameJson.write(value), note, userId.orElse(null))
                .query(Long.class)
                .single();
    }

    public boolean delete(long id) {
        return jdbc.sql("DELETE FROM manual_override WHERE id = ?").param(id).update() > 0;
    }
}
