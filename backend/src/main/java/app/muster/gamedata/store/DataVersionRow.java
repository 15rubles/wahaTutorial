package app.muster.gamedata.store;

import app.muster.gamedata.model.DataVersionStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public record DataVersionRow(
        long id,
        Instant createdAt,
        Optional<String> createdBy,
        DataVersionStatus status,
        Optional<Instant> activatedAt,
        List<String> sourceFiles,
        Map<String, Long> importIds) {}
