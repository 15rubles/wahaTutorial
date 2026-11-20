package app.muster.gamedata.build;

import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.GameEntity;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jdk8.Jdk8Module;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.UncheckedIOException;

/** The one JSON mapper for stored game data. Independent of the web mapper so storage stays stable. */
public final class GameJson {

    public static final ObjectMapper MAPPER = new ObjectMapper()
            .registerModule(new Jdk8Module())
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .setSerializationInclusion(JsonInclude.Include.NON_ABSENT);

    private GameJson() {}

    public static ObjectNode toNode(GameEntity entity) {
        return MAPPER.valueToTree(entity);
    }

    public static <T extends GameEntity> T fromNode(JsonNode node, Class<T> type) {
        try {
            return MAPPER.treeToValue(node, type);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException(e.getOriginalMessage(), e);
        }
    }

    public static GameEntity fromNode(JsonNode node, EntityType type) {
        return fromNode(node, type.recordType());
    }

    private static final com.fasterxml.jackson.core.type.TypeReference<java.util.List<app.muster.gamedata.model.Token>> TOKEN_LIST =
            new com.fasterxml.jackson.core.type.TypeReference<>() {};

    /** Token lists need their declared type, or the polymorphic "type" property is lost. */
    public static JsonNode tokens(java.util.List<app.muster.gamedata.model.Token> tokens) {
        try {
            return MAPPER.readTree(MAPPER.writerFor(TOKEN_LIST).writeValueAsString(tokens));
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static String write(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static JsonNode read(String json) {
        try {
            return MAPPER.readTree(json);
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static <T> T read(String json, Class<T> type) {
        try {
            return MAPPER.readValue(json, type);
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }
}
