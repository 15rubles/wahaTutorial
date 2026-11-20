package app.muster.gamedata.build;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/** Stores a parsed source set as gzipped JSON, so versions can be rebuilt without the raw files. */
public final class SourceSetCodec {

    private SourceSetCodec() {}

    public static byte[] encode(SourceSet set) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (GZIPOutputStream gz = new GZIPOutputStream(bytes)) {
            GameJson.MAPPER.writeValue(gz, set);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    public static SourceSet decode(byte[] payload) {
        try (GZIPInputStream gz = new GZIPInputStream(new ByteArrayInputStream(payload))) {
            return GameJson.MAPPER.readValue(gz, SourceSet.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
