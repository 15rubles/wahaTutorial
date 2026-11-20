package app.muster.gamedata.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

/**
 * Rules text as imported ({@code plain}, paragraphs separated by newlines) and as linked tokens
 * (filled by the RulesTextLinker when a data version is built).
 */
public record RulesText(String plain, List<Token> tokens) {

    public static final RulesText EMPTY = new RulesText("", List.of());

    public RulesText {
        plain = plain == null ? "" : plain;
        tokens = tokens == null ? List.of() : List.copyOf(tokens);
    }

    public static RulesText of(String plain) {
        return new RulesText(plain, List.of());
    }

    @JsonIgnore
    public boolean isBlank() {
        return plain.isBlank();
    }
}
