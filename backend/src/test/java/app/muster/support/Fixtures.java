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

    public static final List<String> WAHAPEDIA_FILES = List.of(
            "Last_update.csv", "Factions.csv", "Source.csv", "Datasheets.csv", "Datasheets_keywords.csv", "Datasheets_models.csv",
            "Datasheets_abilities.csv", "Abilities.csv", "Datasheets_wargear.csv", "Datasheets_options.csv",
            "Datasheets_unit_composition.csv", "Datasheets_models_cost.csv", "Datasheets_enhancements.csv", "Datasheets_leader.csv",
            "Datasheets_stratagems.csv", "Datasheets_detachment_abilities.csv", "Detachments.csv", "Detachments_chapter_dp.csv",
            "Detachment_abilities.csv", "Enhancements.csv", "Stratagems.csv", "Enhancements_wargear.csv", "core-rules.html");

    public static byte[] wahapediaZip() {
        return zip("wahapedia", WAHAPEDIA_FILES);
    }

    public static java.util.Map<String, byte[]> wahapediaFiles() {
        java.util.Map<String, byte[]> m = new java.util.LinkedHashMap<>();
        for (String n : WAHAPEDIA_FILES) m.put(n, resource("wahapedia/" + n));
        return m;
    }

    /** A tiny invented Munitorum Field Manual as a real PDF. */
    public static byte[] mfmPdf(List<String> lines) {
        try (org.apache.pdfbox.pdmodel.PDDocument doc = new org.apache.pdfbox.pdmodel.PDDocument()) {
            org.apache.pdfbox.pdmodel.PDPage page = new org.apache.pdfbox.pdmodel.PDPage();
            doc.addPage(page);
            try (org.apache.pdfbox.pdmodel.PDPageContentStream cs = new org.apache.pdfbox.pdmodel.PDPageContentStream(doc, page)) {
                cs.setFont(new org.apache.pdfbox.pdmodel.font.PDType1Font(org.apache.pdfbox.pdmodel.font.Standard14Fonts.FontName.HELVETICA), 10);
                cs.beginText();
                cs.newLineAtOffset(40, 740);
                for (String l : lines) {
                    cs.showText(l);
                    cs.newLineAtOffset(0, -14);
                }
                cs.endText();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static final List<String> MFM_LINES = List.of(
            "MUNITORUM FIELD MANUAL",
            "RUST PILGRIMS",
            "Pilgrim Warband .......... 10 models .......... 100 pts",
            "20 models .......... 190 pts",
            "Rust Prophet .......... 1 model .......... 80 pts",
            "Ghost Unit .......... 1 model .......... 10 pts",
            "DETACHMENT ENHANCEMENTS",
            "Pilgrimage of Iron",
            "Relic of Rust .......... 30 pts",
            "EMBER WARDENS",
            "Ember Keeper .......... 1 model .......... 90 pts");

    public static byte[] battleScribeZip() {
        return zip("battlescribe", BATTLESCRIBE_FILES);
    }
}
