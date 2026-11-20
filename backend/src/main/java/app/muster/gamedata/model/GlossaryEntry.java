package app.muster.gamedata.model;

import java.util.List;

/**
 * Source for keyword popups. {@code referencedBy} is the reverse index built at import: which rules
 * in the data mention this term (useful for plain unit keywords without rules of their own).
 */
public record GlossaryEntry(
        String key,
        String term,
        List<String> aliases,
        GlossaryKind kind,
        RulesText text,
        List<String> seeAlso,
        List<Reference> referencedBy)
        implements GameEntity {

    public record Reference(EntityType type, String key, String name) {}

    public GlossaryEntry {
        aliases = aliases == null ? List.of() : List.copyOf(aliases);
        seeAlso = seeAlso == null ? List.of() : List.copyOf(seeAlso);
        referencedBy = referencedBy == null ? List.of() : List.copyOf(referencedBy);
        text = text == null ? RulesText.EMPTY : text;
    }

    @Override
    public String name() {
        return term;
    }

    @Override
    public EntityType type() {
        return EntityType.GLOSSARY;
    }
}
