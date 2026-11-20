package app.muster.gamedata.build;

import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.Source;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Everything one import parsed, in the shared model, before merging with other sources. */
public record SourceSet(Source source, List<Item> items, ImportReport report) {

    /** One entity as this source sees it. {@code data} may be partial (only the fields this source knows). */
    public record Item(EntityType type, String key, ObjectNode data, Optional<String> externalId) {}

    public SourceSet {
        items = List.copyOf(items);
    }

    /** Builds a source set, keeping the first entity per (type, key) and reporting duplicates. */
    public static final class Builder {
        private final Source source;
        private final Map<String, Item> items = new LinkedHashMap<>();
        private final ImportReport.Collector report;

        public Builder(Source source, ImportReport.Collector report) {
            this.source = source;
            this.report = report;
        }

        public boolean add(GameEntity entity, String externalId) {
            return addPartial(entity.type(), entity.key(), GameJson.toNode(entity), externalId);
        }

        /** Adds an entity of which this source only knows some fields (for example MFM points). */
        public boolean addPartial(EntityType type, String key, ObjectNode data, String externalId) {
            String id = type + "|" + key;
            if (items.containsKey(id)) {
                report.warn("duplicate", "Duplicate " + type.name().toLowerCase() + " '" + key + "', first one kept", null, key);
                return false;
            }
            data.put("key", key);
            items.put(id, new Item(type, key, data, Optional.ofNullable(externalId)));
            return true;
        }

        /** Sets one field on an entity already added (for data that is only known later, like leader targets). */
        public void patch(EntityType type, String key, String field, com.fasterxml.jackson.databind.JsonNode value) {
            Item item = items.get(type + "|" + key);
            if (item != null) item.data().set(field, value);
        }

        public boolean contains(EntityType type, String key) {
            return items.containsKey(type + "|" + key);
        }

        public ImportReport.Collector report() {
            return report;
        }

        public SourceSet build() {
            return new SourceSet(source, new ArrayList<>(items.values()), report.build());
        }
    }
}
