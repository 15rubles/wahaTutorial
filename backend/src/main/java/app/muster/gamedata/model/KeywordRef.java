package app.muster.gamedata.model;

import java.util.Optional;

/** A keyword as printed ("Sustained Hits 2") plus the glossary entry it links to, once linked. */
public record KeywordRef(String label, Optional<String> glossaryId) {

    public static KeywordRef of(String label) {
        return new KeywordRef(label, Optional.empty());
    }
}
