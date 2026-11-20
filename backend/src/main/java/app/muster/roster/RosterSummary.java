package app.muster.roster;

import java.time.Instant;

public record RosterSummary(long id, String name, Instant createdAt, Instant updatedAt) {}
