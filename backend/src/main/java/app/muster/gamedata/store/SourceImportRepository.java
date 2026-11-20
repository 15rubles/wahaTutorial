package app.muster.gamedata.store;

import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.build.SourceSetCodec;
import app.muster.gamedata.model.Source;
import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class SourceImportRepository {

    public record Summary(long id, Source source, Instant createdAt, List<String> files, ImportReport report) {}

    private final JdbcClient jdbc;

    public SourceImportRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long save(SourceSet set, List<String> files, Optional<Long> createdBy) {
        return jdbc.sql("""
                        INSERT INTO source_import (source, created_by, files, payload, report)
                        VALUES (?, ?, ?::jsonb, ?, ?::jsonb) RETURNING id
                        """)
                .params(set.source().name(), createdBy.orElse(null), GameJson.write(files), SourceSetCodec.encode(set),
                        GameJson.write(set.report()))
                .query(Long.class)
                .single();
    }

    /** Latest import id per source. */
    public Map<Source, Long> latestIds() {
        Map<Source, Long> out = new EnumMap<>(Source.class);
        jdbc.sql("SELECT DISTINCT ON (source) source, id FROM source_import ORDER BY source, id DESC")
                .query((rs, i) -> Map.entry(Source.valueOf(rs.getString("source")), rs.getLong("id")))
                .list()
                .forEach(e -> out.put(e.getKey(), e.getValue()));
        return out;
    }

    public Optional<SourceSet> load(long id) {
        return jdbc.sql("SELECT payload FROM source_import WHERE id = ?")
                .param(id)
                .query((rs, i) -> SourceSetCodec.decode(rs.getBytes(1)))
                .optional();
    }

    public List<Summary> list() {
        return jdbc.sql("SELECT id, source, created_at, files, report FROM source_import ORDER BY id DESC")
                .query((rs, i) -> new Summary(
                        rs.getLong("id"),
                        Source.valueOf(rs.getString("source")),
                        rs.getTimestamp("created_at").toInstant(),
                        GameJson.MAPPER.convertValue(GameJson.read(rs.getString("files")), new TypeReference<List<String>>() {}),
                        GameJson.read(rs.getString("report"), ImportReport.class)))
                .list();
    }
}
