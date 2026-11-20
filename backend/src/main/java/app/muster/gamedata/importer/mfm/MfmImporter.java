package app.muster.gamedata.importer.mfm;

import app.muster.common.ApiException;
import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.build.Keys;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.Source;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

/**
 * Reads points from the Munitorum Field Manual PDF: faction headings, unit size lines
 * ("Plague Marines .... 5 models .... 90 pts", continuation lines with only a size) and the
 * detachment enhancement lists. Only points are taken from here; every row is matched to a datasheet
 * or enhancement by key when the version is built, and unmatched rows are reported.
 */
@Component
public class MfmImporter {

    private static final Pattern UNIT_LINE = Pattern.compile("^(.+?)\\s+(\\d+)\\s+models?\\s+(\\d+)\\s*pts$", Pattern.CASE_INSENSITIVE);
    private static final Pattern SIZE_LINE = Pattern.compile("^(\\d+)\\s+models?\\s+(\\d+)\\s*pts$", Pattern.CASE_INSENSITIVE);
    private static final Pattern POINTS_LINE = Pattern.compile("^(.+?)\\s+(\\d+)\\s*pts$", Pattern.CASE_INSENSITIVE);
    private static final Pattern PREFIX = Pattern.compile("^(CODEX|INDEX|CODEX SUPPLEMENT|FACTION PACK|IMPERIAL ARMOUR)\\s*:\\s*", Pattern.CASE_INSENSITIVE);

    public SourceSet importPdf(byte[] pdf) {
        String text;
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            text = stripper.getText(doc);
        } catch (IOException e) {
            throw ApiException.badRequest("BAD_PDF", "The uploaded file is not a readable PDF: " + e.getMessage());
        }
        return parseText(text);
    }

    /** Parses the extracted text (public for tests). */
    public SourceSet parseText(String text) {
        ImportReport.Collector report = new ImportReport.Collector();
        SourceSet.Builder out = new SourceSet.Builder(Source.MFM, report);
        Optional<String> faction = Optional.empty();
        Optional<String> unit = Optional.empty();
        Optional<String> detachment = Optional.empty();
        boolean enhancements = false;
        int lineNo = 0;
        for (String raw : text.split("\\R")) {
            lineNo++;
            String line = normalize(raw);
            if (line.isEmpty()) continue;
            String upper = line.toUpperCase(Locale.ROOT);

            Matcher size = SIZE_LINE.matcher(line);
            Matcher unitLine = UNIT_LINE.matcher(line);
            Matcher pts = POINTS_LINE.matcher(line);

            if (upper.contains("ENHANCEMENTS") && !pts.matches()) {
                enhancements = true;
                detachment = Optional.empty();
                continue;
            }
            if (faction.isPresent() && !enhancements && size.matches() && unit.isPresent()) {
                addSize(out, report, faction.get(), unit.get(), Integer.parseInt(size.group(1)), Integer.parseInt(size.group(2)));
                continue;
            }
            if (faction.isPresent() && !enhancements && unitLine.matches()) {
                unit = Optional.of(unitLine.group(1).trim());
                addSize(out, report, faction.get(), unit.get(), Integer.parseInt(unitLine.group(2)), Integer.parseInt(unitLine.group(3)));
                continue;
            }
            if (enhancements && pts.matches() && faction.isPresent()) {
                if (detachment.isEmpty()) {
                    report.warn("unparsed-line", "Enhancement before any detachment name (line " + lineNo + "): " + line, faction.get(), null);
                    continue;
                }
                String detKey = Keys.detachment(faction.get(), detachment.get());
                String name = pts.group(1).trim();
                ObjectNode node = GameJson.MAPPER.createObjectNode();
                node.put("detachment", detKey);
                node.put("faction", faction.get());
                node.put("name", name);
                node.put("points", Integer.parseInt(pts.group(2)));
                out.addPartial(EntityType.ENHANCEMENT, Keys.child(detKey, "enh", name), node, null);
                report.count(faction.get(), "enhancement");
                continue;
            }
            if (isHeading(line)) {
                faction = Optional.of(Keys.faction(PREFIX.matcher(line).replaceFirst("")));
                unit = Optional.empty();
                detachment = Optional.empty();
                enhancements = false;
                report.count(faction.get(), "faction");
                continue;
            }
            if (enhancements && !pts.matches()) {
                detachment = Optional.of(line);
                continue;
            }
            if (!pts.matches() && faction.isPresent()) {
                // A unit name on its own line, sizes follow.
                unit = Optional.of(line);
                continue;
            }
            report.info("unparsed-line", "Line " + lineNo + " not understood: " + line, faction.orElse(null), null);
        }
        if (out.build().items().isEmpty()) {
            throw ApiException.badRequest("MFM_EMPTY", "No points could be read from this PDF. Is it the Munitorum Field Manual?");
        }
        return out.build();
    }

    private static void addSize(SourceSet.Builder out, ImportReport.Collector report, String faction, String unit, int models, int points) {
        String sheet = Keys.datasheet(faction, unit);
        ObjectNode node = GameJson.MAPPER.createObjectNode();
        node.put("datasheet", sheet);
        node.put("faction", faction);
        node.put("name", models + (models == 1 ? " model" : " models"));
        node.put("models", models);
        node.put("points", points);
        out.addPartial(EntityType.UNIT_SIZE, Keys.unitSize(sheet, models), node, null);
        report.count(faction, "unit_size");
    }

    /** Dot leaders, odd spaces and long dashes removed. */
    static String normalize(String raw) {
        return raw.replace(' ', ' ')
                .replaceAll("\\.{2,}", " ")
                .replaceAll("[–—]", "-")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /** Faction headings are upper case lines without points. */
    static boolean isHeading(String line) {
        String letters = line.replaceAll("[^A-Za-z]", "");
        return letters.length() >= 3 && line.equals(line.toUpperCase(Locale.ROOT)) && !line.matches(".*\\d+\\s*pts.*")
                && !List.of("POINTS", "MUNITORUM FIELD MANUAL", "UNITS").contains(line.trim());
    }
}
