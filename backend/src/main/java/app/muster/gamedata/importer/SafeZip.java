package app.muster.gamedata.importer;

import app.muster.common.ApiException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Reads uploaded zips with limits on entry count and uncompressed size (zip bomb protection). */
public final class SafeZip {

    public static final long MAX_TOTAL_BYTES = 400L * 1024 * 1024;
    public static final int MAX_ENTRIES = 2000;

    private SafeZip() {}

    /** Entry name (without directories) -> bytes, for entries whose extension is in {@code extensions}. */
    public static Map<String, byte[]> read(byte[] zip, String... extensions) {
        Map<String, byte[]> out = new LinkedHashMap<>();
        long total = 0;
        int count = 0;
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                if (++count > MAX_ENTRIES) throw tooBig("too many entries");
                if (e.isDirectory()) continue;
                String name = e.getName().replace('\\', '/');
                name = name.substring(name.lastIndexOf('/') + 1);
                if (name.startsWith(".") || !hasExtension(name, extensions)) continue;
                byte[] bytes = readLimited(in, MAX_TOTAL_BYTES - total);
                total += bytes.length;
                out.put(name, bytes);
            }
        } catch (IOException ex) {
            throw ApiException.badRequest("BAD_ZIP", "The uploaded file is not a readable zip: " + ex.getMessage());
        }
        return out;
    }

    /** First entry of a single-file zip (for .gstz / .catz). */
    public static byte[] single(byte[] zip) {
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                if (!e.isDirectory()) return readLimited(in, MAX_TOTAL_BYTES);
            }
        } catch (IOException ex) {
            throw ApiException.badRequest("BAD_ZIP", "Nested archive is not readable: " + ex.getMessage());
        }
        throw ApiException.badRequest("BAD_ZIP", "Nested archive is empty");
    }

    public static boolean isZip(byte[] bytes) {
        return bytes.length > 3 && bytes[0] == 'P' && bytes[1] == 'K' && bytes[2] == 3 && bytes[3] == 4;
    }

    private static boolean hasExtension(String name, String... extensions) {
        String lower = name.toLowerCase(Locale.ROOT);
        for (String ext : extensions) if (lower.endsWith(ext)) return true;
        return extensions.length == 0;
    }

    private static byte[] readLimited(InputStream in, long limit) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[64 * 1024];
        long read = 0;
        int n;
        while ((n = in.read(buf)) > 0) {
            read += n;
            if (read > limit) throw tooBig("uncompressed size over " + (MAX_TOTAL_BYTES / 1024 / 1024) + " MB");
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static ApiException tooBig(String why) {
        return ApiException.badRequest("ZIP_TOO_LARGE", "The archive is too large: " + why);
    }
}
