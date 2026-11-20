package app.muster.health;

import java.time.Instant;

/** Body of GET /api/health. */
public record HealthResponse(HealthStatus status, HealthStatus database, Instant checkedAt) {}
