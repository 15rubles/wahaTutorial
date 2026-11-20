package app.muster.gamedata.build;

import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.Token;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns rules text into tokens: plain text and references to glossary entries. Matching is
 * case-insensitive, whole words, longest term first, and keeps parameters with the term
 * ("Sustained Hits 2" links to "Sustained Hits", "Anti-Infantry 4+" links to "Anti").
 */
public final class RulesTextLinker {

    // Parameters printed after a term: "2", "D3", "D6+1", "4+", "6\"", "X".
    private static final String PARAM = "(?:\\s+(?:\\d+\\+|D\\d+(?:\\+\\d+)?|\\d+\"?|X))?";
    // Hyphenated forms like "Anti-Infantry 4+": term ending in a hyphen plus a word and parameter.
    private static final String HYPHEN_TAIL = "-[A-Za-z][A-Za-z ]*?(?:\\s+\\d+\\+)";

    private final Pattern pattern;
    private final Map<String, String> termToKey;

    public RulesTextLinker(List<GlossaryEntry> glossary) {
        this.termToKey = new HashMap<>();
        List<String> terms = new ArrayList<>();
        for (GlossaryEntry g : glossary) {
            for (String t : allTerms(g)) {
                String norm = normalize(t);
                if (norm.length() < 2 || termToKey.containsKey(norm)) continue;
                termToKey.put(norm, g.key());
                terms.add(t.trim());
            }
        }
        terms.sort(Comparator.comparingInt(String::length).reversed());
        if (terms.isEmpty()) {
            this.pattern = null;
            return;
        }
        StringBuilder alt = new StringBuilder();
        for (String t : terms) {
            if (alt.length() > 0) alt.append('|');
            alt.append(Pattern.quote(t));
        }
        // Group 1: the term. Then an optional hyphen tail (Anti-X 4+) or parameter.
        this.pattern = Pattern.compile(
                "(?<![\\p{L}\\p{N}])(" + alt + ")(" + HYPHEN_TAIL + "|" + PARAM + ")(?![\\p{L}\\p{N}])",
                Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    }

    private static List<String> allTerms(GlossaryEntry g) {
        List<String> all = new ArrayList<>();
        all.add(g.term());
        all.addAll(g.aliases());
        return all;
    }

    static String normalize(String term) {
        return term.trim().toLowerCase(Locale.ROOT).replace('’', '\'').replaceAll("\\s+", " ");
    }

    /** Links text; references to {@code selfKey} stay plain text (an entry never links to itself). */
    public List<Token> link(String text, Optional<String> selfKey) {
        if (text == null || text.isEmpty()) return List.of();
        if (pattern == null) return List.of(new Token.Text(text));
        List<Token> out = new ArrayList<>();
        Matcher m = pattern.matcher(text);
        int last = 0;
        StringBuilder pending = new StringBuilder();
        while (m.find()) {
            String key = termToKey.get(normalize(m.group(1)));
            if (key == null || selfKey.map(key::equals).orElse(false)) continue;
            pending.append(text, last, m.start());
            if (pending.length() > 0) {
                out.add(new Token.Text(pending.toString()));
                pending.setLength(0);
            }
            out.add(new Token.Ref(key, m.group()));
            last = m.end();
        }
        pending.append(text.substring(last));
        if (pending.length() > 0) out.add(new Token.Text(pending.toString()));
        return out;
    }

    /** Resolves a single printed keyword ("Sustained Hits 2", "anti-vehicle 4+") to a glossary key. */
    public Optional<String> resolve(String label) {
        if (pattern == null || label == null) return Optional.empty();
        Matcher m = pattern.matcher(label.trim());
        if (m.matches()) return Optional.ofNullable(termToKey.get(normalize(m.group(1))));
        return Optional.ofNullable(termToKey.get(normalize(label)));
    }
}
