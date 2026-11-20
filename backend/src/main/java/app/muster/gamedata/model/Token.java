package app.muster.gamedata.model;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/** A piece of linked rules text: plain text or a reference to a glossary entry. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({@JsonSubTypes.Type(value = Token.Text.class, name = "text"), @JsonSubTypes.Type(value = Token.Ref.class, name = "ref")})
public sealed interface Token {

    record Text(String value) implements Token {}

    record Ref(String glossaryId, String label) implements Token {}
}
