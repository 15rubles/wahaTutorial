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
 *
 * <p>Terms are indexed by their first word, so each word of the text is checked only against the
 * few terms that start with it (fast enough for tens of thousands of rules texts).
 */
public final class RulesTextLinker {

    // Parameters printed after a term: "2", "D3", "D6+1", "4+", "6\"", "X".
    private static final Pattern PARAM = Pattern.compile("\\s+(?:\\d+\\+|D\\d+(?:\\+\\d+)?|\\d+\"?|X)(?![\\p{L}\\p{N}])");
    // Hyphenated forms like "Anti-Infantry 4+" or "Anti-monster/Vehicle": a hyphen, words, optional "N+".
    private static final Pattern HYPHEN_TAIL = Pattern.compile("-[A-Za-z][A-Za-z/-]*(?:\\s+(?!\\d)[A-Za-z][A-Za-z/-]*)*?(?:\\s+\\d+\\+)?(?![\\p{L}\\p{N}])");

    private record Term(String text, String key) {}

    private final Map<String, List<Term>> byFirstWord = new HashMap<>();
    private final Map<String, String> termToKey = new HashMap<>();

    public RulesTextLinker(List<GlossaryEntry> glossary) {
        for (GlossaryEntry g : glossary) {
            List<String> all = new ArrayList<>();
            all.add(g.term());
            all.addAll(g.aliases());
            for (String t : all) {
                String norm = normalize(t);
                if (norm.length() < 2 || termToKey.containsKey(norm)) continue;
                termToKey.put(norm, g.key());
                String first = firstWord(norm, 0);
                if (first.isEmpty()) continue;
                byFirstWord.computeIfAbsent(first, k -> new ArrayList<>()).add(new Term(norm, g.key()));
            }
        }
        byFirstWord.values().forEach(l -> l.sort(Comparator.comparingInt((Term t) -> t.text().length()).reversed()));
    }

    static String normalize(String term) {
        return term.trim().toLowerCase(Locale.ROOT).replace('’', '\'').replaceAll("\\s+", " ");
    }

    private static boolean isWordChar(char c) {
        return Character.isLetterOrDigit(c);
    }

    /** The word starting at {@code i}: letters, digits and apostrophes, lower case. */
    private static String firstWord(String s, int i) {
        int j = i;
        while (j < s.length() && (isWordChar(s.charAt(j)) || s.charAt(j) == '\'' || s.charAt(j) == '’')) j++;
        return s.substring(i, j).toLowerCase(Locale.ROOT).replace('’', '\'');
    }

    /** End of a match of {@code term} at {@code start} in {@code text}, or -1. */
    private static int matchAt(String text, int start, String term) {
        int n = term.length();
        if (start + n > text.length()) return -1;
        for (int k = 0; k < n; k++) {
            char a = Character.toLowerCase(text.charAt(start + k));
            if (a == '’') a = '\'';
            char b = term.charAt(k);
            if (a == b) continue;
            if (Character.isWhitespace(a) && b == ' ') continue;
            return -1;
        }
        return start + n;
    }

    /** Extends a match over a hyphen tail or a parameter; returns the end of the whole label, or -1. */
    private static int extend(String text, int end) {
        if (end < text.length() && text.charAt(end) == '-') {
            Matcher h = HYPHEN_TAIL.matcher(text).region(end, text.length());
            if (h.lookingAt()) return h.end();
        }
        Matcher p = PARAM.matcher(text).region(end, text.length());
        if (p.lookingAt()) return p.end();
        if (end < text.length() && isWordChar(text.charAt(end))) return -1;
        return end;
    }

    /** Links text; references to {@code selfKey} stay plain text (an entry never links to itself). */
    public List<Token> link(String text, Optional<String> selfKey) {
        if (text == null || text.isEmpty()) return List.of();
        if (byFirstWord.isEmpty()) return List.of(new Token.Text(text));
        List<Token> out = new ArrayList<>();
        StringBuilder pending = new StringBuilder();
        int i = 0;
        int last = 0;
        while (i < text.length()) {
            char c = text.charAt(i);
            boolean wordStart = isWordChar(c) && (i == 0 || !isWordChar(text.charAt(i - 1)));
            if (!wordStart) {
                i++;
                continue;
            }
            String word = firstWord(text, i);
            List<Term> candidates = byFirstWord.get(word);
            int matchedEnd = -1;
            String matchedKey = null;
            if (candidates != null) {
                for (Term t : candidates) {
                    int end = matchAt(text, i, t.text());
                    if (end < 0) continue;
                    int full = extend(text, end);
                    if (full < 0) continue;
                    if (selfKey.map(t.key()::equals).orElse(false)) continue;
                    matchedEnd = full;
                    matchedKey = t.key();
                    break;
                }
            }
            if (matchedEnd < 0) {
                i += Math.max(1, word.length());
                continue;
            }
            pending.append(text, last, i);
            if (pending.length() > 0) {
                out.add(new Token.Text(pending.toString()));
                pending.setLength(0);
            }
            out.add(new Token.Ref(matchedKey, text.substring(i, matchedEnd)));
            last = matchedEnd;
            i = matchedEnd;
        }
        pending.append(text.substring(last));
        if (pending.length() > 0) out.add(new Token.Text(pending.toString()));
        return out;
    }

    /** Resolves a single printed keyword ("Sustained Hits 2", "anti-vehicle 4+") to a glossary key. */
    public Optional<String> resolve(String label) {
        if (label == null || byFirstWord.isEmpty()) return Optional.empty();
        // Conditional forms ("Lethal Hits: non-MONSTER/VEHICLE") link to the base ability.
        String base = (label.contains(":") ? label.substring(0, label.indexOf(':')) : label).trim();
        if (base.isEmpty()) return Optional.empty();
        String direct = termToKey.get(normalize(base));
        if (direct != null) return Optional.of(direct);
        List<Token> tokens = link(base, Optional.empty());
        if (tokens.size() == 1 && tokens.get(0) instanceof Token.Ref r) return Optional.of(r.glossaryId());
        return Optional.empty();
    }
}
