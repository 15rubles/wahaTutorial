package app.muster.auth;

import java.security.SecureRandom;
import java.util.Locale;

/** Generates and normalizes human friendly invite codes like {@code K7QX-M2PA-9DHT}. */
public final class InviteCodes {

    // No 0/O, 1/I/L to avoid typos when a friend types the code by hand.
    private static final char[] ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private InviteCodes() {}

    public static String generate() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 12; i++) {
            if (i > 0 && i % 4 == 0) sb.append('-');
            sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    /** Uppercases, strips spaces and re-inserts the dashes, so "k7qx m2pa9dht" still matches. */
    public static String normalize(String input) {
        String raw = input.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (raw.length() != 12) return raw;
        return raw.substring(0, 4) + "-" + raw.substring(4, 8) + "-" + raw.substring(8);
    }
}
