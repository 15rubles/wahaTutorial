package app.muster.gamedata.store;

import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.VersionReport;
import app.muster.gamedata.model.DataVersionStatus;
import com.fasterxml.jackson.core.type.TypeReference;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class DataVersionRepository {

    private static final String SELECT = """
            SELECT v.id, v.created_at, u.username AS created_by_name, v.status, v.activated_at, v.source_files, v.import_ids
            FROM data_version v LEFT JOIN app_user u ON u.id = v.created_by
            """;

    private final JdbcClient jdbc;

    public DataVersionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long create(Optional<Long> createdBy, List<String> sourceFiles, Map<String, Long> importIds, VersionReport report) {
        return jdbc.sql("""
                        INSERT INTO data_version (created_by, status, source_files, import_ids, report)
                        VALUES (?, 'DRAFT', ?::jsonb, ?::jsonb, ?::jsonb) RETURNING id
                        """)
                .params(createdBy.orElse(null), GameJson.write(sourceFiles), GameJson.write(importIds), GameJson.write(report))
                .query(Long.class)
                .single();
    }

    public Optional<DataVersionRow> find(long id) {
        return jdbc.sql(SELECT + " WHERE v.id = ?").param(id).query(this::map).optional();
    }

    public Optional<DataVersionRow> active() {
        return jdbc.sql(SELECT + " WHERE v.status = 'ACTIVE'").query(this::map).optional();
    }

    public Optional<Long> activeId() {
        return jdbc.sql("SELECT id FROM data_version WHERE status = 'ACTIVE'").query(Long.class).optional();
    }

    public List<DataVersionRow> list() {
        return jdbc.sql(SELECT + " ORDER BY v.id DESC").query(this::map).list();
    }

    public Optional<VersionReport> report(long id) {
        return jdbc.sql("SELECT report FROM data_version WHERE id = ?")
                .param(id)
                .query(String.class)
                .optional()
                .map(json -> GameJson.read(json, VersionReport.class));
    }

    public void updateReport(long id, VersionReport report) {
        jdbc.sql("UPDATE data_version SET report = ?::jsonb WHERE id = ?").params(GameJson.write(report), id).update();
    }

    /** Archives the current active version and activates {@code id}. Call inside a transaction. */
    public void activate(long id, Instant now) {
        jdbc.sql("UPDATE data_version SET status = 'ARCHIVED' WHERE status = 'ACTIVE' AND id <> ?").param(id).update();
        jdbc.sql("UPDATE data_version SET status = 'ACTIVE', activated_at = ? WHERE id = ?")
                .params(java.sql.Timestamp.from(now), id)
                .update();
    }

    /** Ids of versions whose content follows overrides immediately (active and drafts). */
    public List<Long> liveIds() {
        return jdbc.sql("SELECT id FROM data_version WHERE status IN ('ACTIVE', 'DRAFT') ORDER BY id").query(Long.class).list();
    }

    private DataVersionRow map(ResultSet rs, int i) throws SQLException {
        return new DataVersionRow(
                rs.getLong("id"),
                rs.getTimestamp("created_at").toInstant(),
                Optional.ofNullable(rs.getString("created_by_name")),
                DataVersionStatus.valueOf(rs.getString("status")),
                Optional.ofNullable(rs.getTimestamp("activated_at")).map(java.sql.Timestamp::toInstant),
                GameJson.MAPPER.convertValue(GameJson.read(rs.getString("source_files")), new TypeReference<List<String>>() {}),
                GameJson.MAPPER.convertValue(GameJson.read(rs.getString("import_ids")), new TypeReference<Map<String, Long>>() {}));
    }
}
