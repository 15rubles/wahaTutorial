package app.muster.gamedata.build;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Stable keys for game data. A key is derived from normalized names, so the same unit gets the same
 * key from every source and in every data version: {@code death-guard:plague-marines}.
 */
public final class Keys {

    static final int MAX_SLUG = 80;

    private Keys() {}

    /** "Lord of Virulence" -> "lord-of-virulence", "Kor'sarro Khan" -> "korsarro-khan". */
    public static String slug(String name) {
        String n = Normalizer.normalize(name, Normalizer.Form.NFKD).replaceAll("\\p{M}", "");
        n = n.toLowerCase(Locale.ROOT)
                .replace("’", "")
                .replace("'", "")
                .replace("‘", "")
                .replace("`", "");
        n = n.replaceAll("\\[legends]", " ");
        n = n.replaceAll("[^a-z0-9]+", "-");
        n = n.replaceAll("^-+|-+$", "");
        if (n.isEmpty()) return "unnamed";
        if (n.length() > MAX_SLUG) {
            // Long names (for example unit compositions) keep a readable prefix plus a stable hash.
            String hash = Integer.toHexString(n.hashCode() & 0x7fffffff);
            n = n.substring(0, MAX_SLUG - hash.length() - 1).replaceAll("-+$", "") + "-" + hash;
        }
        return n;
    }

    /** Name comparison that ignores case, accents, punctuation and plural "s". */
    public static String matchName(String name) {
        String s = slug(name);
        return s.endsWith("s") && s.length() > 3 ? s.substring(0, s.length() - 1) : s;
    }

    public static String faction(String factionName) {
        return slug(factionName);
    }

    public static String datasheet(String factionKey, String name) {
        return factionKey + ":" + slug(name);
    }

    public static String child(String parentKey, String kind, String name) {
        return parentKey + ":" + kind + ":" + slug(name);
    }

    public static String unitSize(String datasheetKey, int models) {
        return datasheetKey + ":size:" + models;
    }

    public static String detachment(String factionKey, String name) {
        return factionKey + ":det:" + slug(name);
    }

    public static String coreStratagem(String name) {
        return "core:strat:" + slug(name);
    }

    public static String glossary(String term) {
        return "g:" + slug(term);
    }

    public static String battleSize(String name) {
        return "battle-size:" + slug(name);
    }

    public static String forceDisposition(String name) {
        return "fd:" + slug(name);
    }
}
