package app.muster.roster;

import app.muster.gamedata.build.GameJson;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterFlags;
import app.muster.roster.model.WargearChoice;
import com.fasterxml.jackson.core.type.TypeReference;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RosterRepository {

    private static final String SELECT = """
            SELECT id, owner_id, name, faction_key, data_version_id, battle_size_key, faction_options, force_disposition,
                   flags, points_total, legal, created_at, updated_at FROM roster
            """;

    private final JdbcClient jdbc;

    public RosterRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long create(long ownerId, String name, String factionKey, long versionId, Optional<String> battleSizeKey) {
        return jdbc.sql("""
                        INSERT INTO roster (owner_id, name, faction_key, data_version_id, battle_size_key, flags)
                        VALUES (?, ?, ?, ?, ?, ?::jsonb) RETURNING id
                        """)
                .params(ownerId, name, factionKey, versionId, battleSizeKey.orElse(null), GameJson.write(RosterFlags.DEFAULT))
                .query(Long.class)
                .single();
    }

    public Optional<RosterRow> findOwned(long id, long ownerId) {
        return jdbc.sql(SELECT + " WHERE id = ? AND owner_id = ? AND faction_key IS NOT NULL").params(id, ownerId).query(this::row).optional();
    }

    public List<RosterRow> listForOwner(long ownerId) {
        return jdbc.sql(SELECT + " WHERE owner_id = ? AND faction_key IS NOT NULL ORDER BY updated_at DESC").param(ownerId).query(this::row).list();
    }

    public void updateConfig(RosterRow r) {
        jdbc.sql("""
                        UPDATE roster SET name = ?, battle_size_key = ?, faction_options = ?::jsonb, force_disposition = ?,
                               flags = ?::jsonb, updated_at = now() WHERE id = ?
                        """)
                .params(r.name(), r.battleSizeKey().orElse(null), GameJson.write(r.factionOptions()), r.forceDisposition().orElse(null),
                        GameJson.write(r.flags()), r.id())
                .update();
    }

    public void setVersion(long id, long versionId) {
        jdbc.sql("UPDATE roster SET data_version_id = ?, updated_at = now() WHERE id = ?").params(versionId, id).update();
    }

    public void touch(long id) {
        jdbc.sql("UPDATE roster SET updated_at = now() WHERE id = ?").param(id).update();
    }

    public void updateTotals(long id, int points, boolean legal) {
        jdbc.sql("UPDATE roster SET points_total = ?, legal = ? WHERE id = ? AND (points_total <> ? OR legal <> ?)")
                .params(points, legal, id, points, legal)
                .update();
    }

    public boolean delete(long id, long ownerId) {
        return jdbc.sql("DELETE FROM roster WHERE id = ? AND owner_id = ?").params(id, ownerId).update() > 0;
    }

    // ---- detachments ------------------------------------------------------------------------------

    public List<String> detachments(long rosterId) {
        return jdbc.sql("SELECT detachment_key FROM roster_detachment WHERE roster_id = ? ORDER BY position")
                .param(rosterId).query(String.class).list();
    }

    public void setDetachments(long rosterId, List<String> keys) {
        jdbc.sql("DELETE FROM roster_detachment WHERE roster_id = ?").param(rosterId).update();
        int pos = 0;
        for (String k : keys) {
            jdbc.sql("INSERT INTO roster_detachment (roster_id, detachment_key, position) VALUES (?, ?, ?)").params(rosterId, k, pos++).update();
        }
    }

    // ---- entries ----------------------------------------------------------------------------------

    public List<RosterEntry> entries(long rosterId) {
        return jdbc.sql("""
                        SELECT id, datasheet_key, size_key, wargear, enhancement_key, warlord, attached_to, sort_order
                        FROM roster_entry WHERE roster_id = ? ORDER BY sort_order, id
                        """)
                .param(rosterId)
                .query(this::entry)
                .list();
    }

    public Optional<RosterEntry> entry(long rosterId, long entryId) {
        return jdbc.sql("""
                        SELECT id, datasheet_key, size_key, wargear, enhancement_key, warlord, attached_to, sort_order
                        FROM roster_entry WHERE roster_id = ? AND id = ?
                        """)
                .params(rosterId, entryId)
                .query(this::entry)
                .optional();
    }

    public long addEntry(long rosterId, String datasheetKey, String sizeKey) {
        int next = jdbc.sql("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM roster_entry WHERE roster_id = ?").param(rosterId).query(Integer.class).single();
        return jdbc.sql("INSERT INTO roster_entry (roster_id, datasheet_key, size_key, sort_order) VALUES (?, ?, ?, ?) RETURNING id")
                .params(rosterId, datasheetKey, sizeKey, next)
                .query(Long.class)
                .single();
    }

    public void updateEntry(long rosterId, RosterEntry e) {
        jdbc.sql("""
                        UPDATE roster_entry SET size_key = ?, wargear = ?::jsonb, enhancement_key = ?, warlord = ?, attached_to = ?, sort_order = ?
                        WHERE roster_id = ? AND id = ?
                        """)
                .params(e.sizeKey(), GameJson.write(e.wargear()), e.enhancementKey().orElse(null), e.warlord(), e.attachedTo().orElse(null),
                        e.sortOrder(), rosterId, e.id())
                .update();
    }

    public void clearWarlords(long rosterId, long exceptId) {
        jdbc.sql("UPDATE roster_entry SET warlord = FALSE WHERE roster_id = ? AND id <> ?").params(rosterId, exceptId).update();
    }

    public void deleteEntry(long rosterId, long entryId) {
        jdbc.sql("DELETE FROM roster_entry WHERE roster_id = ? AND id = ?").params(rosterId, entryId).update();
    }

    /** Copies a roster with its detachments and entries (attachments re-pointed to the copies). */
    public long duplicate(RosterRow source, String newName) {
        long copy = jdbc.sql("""
                        INSERT INTO roster (owner_id, name, faction_key, data_version_id, battle_size_key, faction_options, force_disposition,
                                            flags, points_total, legal)
                        SELECT owner_id, ?, faction_key, data_version_id, battle_size_key, faction_options, force_disposition, flags, points_total, legal
                        FROM roster WHERE id = ? RETURNING id
                        """)
                .params(newName, source.id())
                .query(Long.class)
                .single();
        setDetachments(copy, detachments(source.id()));
        Map<Long, Long> ids = new HashMap<>();
        List<RosterEntry> entries = entries(source.id());
        for (RosterEntry e : entries) {
            long id = jdbc.sql("""
                            INSERT INTO roster_entry (roster_id, datasheet_key, size_key, wargear, enhancement_key, warlord, sort_order)
                            VALUES (?, ?, ?, ?::jsonb, ?, ?, ?) RETURNING id
                            """)
                    .params(copy, e.datasheetKey(), e.sizeKey(), GameJson.write(e.wargear()), e.enhancementKey().orElse(null), e.warlord(), e.sortOrder())
                    .query(Long.class)
                    .single();
            ids.put(e.id(), id);
        }
        for (RosterEntry e : entries) {
            e.attachedTo().map(ids::get).ifPresent(t ->
                    jdbc.sql("UPDATE roster_entry SET attached_to = ? WHERE id = ?").params(t, ids.get(e.id())).update());
        }
        return copy;
    }

    private RosterRow row(ResultSet rs, int i) throws SQLException {
        return new RosterRow(
                rs.getLong("id"),
                rs.getLong("owner_id"),
                rs.getString("name"),
                rs.getString("faction_key"),
                rs.getLong("data_version_id"),
                Optional.ofNullable(rs.getString("battle_size_key")),
                GameJson.MAPPER.convertValue(GameJson.read(rs.getString("faction_options")), new TypeReference<Map<String, String>>() {}),
                Optional.ofNullable(rs.getString("force_disposition")),
                flags(rs.getString("flags")),
                rs.getInt("points_total"),
                rs.getBoolean("legal"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant());
    }

    private static RosterFlags flags(String json) {
        var node = GameJson.read(json);
        return new RosterFlags(node.path("legends").asBoolean(false), node.path("unalignedForces").asBoolean(false),
                node.path("unalignedFortifications").asBoolean(false));
    }

    private RosterEntry entry(ResultSet rs, int i) throws SQLException {
        long attached = rs.getLong("attached_to");
        boolean noAttach = rs.wasNull();
        return new RosterEntry(
                rs.getLong("id"),
                rs.getString("datasheet_key"),
                rs.getString("size_key"),
                GameJson.MAPPER.convertValue(GameJson.read(rs.getString("wargear")), new TypeReference<List<WargearChoice>>() {}),
                Optional.ofNullable(rs.getString("enhancement_key")),
                rs.getBoolean("warlord"),
                noAttach ? Optional.empty() : Optional.of(attached),
                rs.getInt("sort_order"));
    }
}
