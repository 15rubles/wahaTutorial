package app.muster.support;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Invented test data (DESIGN.md: real game data never goes into the repo). */
public final class Fixtures {

    public static final List<String> BATTLESCRIBE_FILES = List.of(
            "Testing Grounds.gst", "Imperium - Rust Pilgrims.cat", "Rust Pilgrims Library.cat", "Imperium - Ember Wardens.cat");

    private Fixtures() {}

    public static byte[] resource(String path) {
        try (InputStream in = Fixtures.class.getResourceAsStream("/fixtures/" + path)) {
            if (in == null) throw new IllegalArgumentException("No fixture " + path);
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static byte[] zip(String dir, List<String> names) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            for (String n : names) {
                zip.putNextEntry(new ZipEntry("data/" + n));
                zip.write(resource(dir + "/" + n));
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    public static byte[] battleScribeZip() {
        return zip("battlescribe", BATTLESCRIBE_FILES);
    }
}
