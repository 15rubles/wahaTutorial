package app.muster.gamedata.importer.wahapedia;

import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.build.Keys;
import app.muster.gamedata.importer.TextCleaner;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.gamedata.model.RulesText;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

/**
 * Reads the core rules page: core and weapon abilities (ability blocks), rule terms (numbered section
 * headings) and the battle size table with the army construction limits around it.
 */
public final class CoreRulesParser {

    public record Result(List<GlossaryEntry> glossary, List<BattleSize> battleSizes) {}

    private static final Pattern CODE = Pattern.compile("\\d{2}(\\.\\d{2})+|\\d{2}");
    private static final Set<String> GENERIC_HEADINGS = Set.of(
            "books", "introduction", "dice", "armies", "moving", "datasheets", "keywords", "profiles", "abilities",
            "weapons", "movement", "shooting", "deployment", "see also", "example", "examples", "faq", "stratagems",
            "objectives", "terrain", "actions");
    private static final int MAX_TEXT = 6000;

    private CoreRulesParser() {}

    public static Result parse(String html, ImportReport.Collector report) {
        Document doc = Jsoup.parse(html);
        doc.select("script, style, .ShowFluff, .tooltip_templates, .NoPrint, noscript, .faqErrataSpoiler, .CornerSeeAlso").remove();
        Map<String, GlossaryEntry> glossary = new LinkedHashMap<>();

        for (Element block : doc.select("div.abWrap")) {
            Element nameEl = block.selectFirst("div.abName");
            if (nameEl == null) continue;
            Element nameWrap = block.selectFirst("div.abNameWrap");
            Element copy = block.clone();
            copy.select("div.abNameWrap, div.redExample, .CornerSeeAlso").remove();
            String text = TextCleaner.html(copy.html());
            String rawName = nameEl.ownText().isBlank() ? nameEl.text() : nameEl.text();
            rawName = rawName.replaceAll("\\d{2}\\.\\d{2}", " ").trim();
            boolean weapon = rawName.contains("[");
            for (String part : rawName.split("/")) {
                String term = titleCase(part.replace("[", "").replace("]", "").trim());
                if (term.isEmpty()) continue;
                String key = Keys.glossary(term);
                if (glossary.containsKey(key)) continue;
                List<String> aliases = term.equalsIgnoreCase("anti") ? List.of() : List.of();
                glossary.put(key, new GlossaryEntry(key, term, aliases,
                        weapon ? GlossaryKind.WEAPON_ABILITY : GlossaryKind.CORE_ABILITY, RulesText.of(text), List.of(), List.of()));
                report.count("core", "glossary");
            }
            if (nameWrap == null) report.warn("core-rules", "Ability block without name wrapper: " + rawName, "core", null);
        }

        Elements headings = doc.select("h2[id], h3[id]");
        for (int i = 0; i < headings.size(); i++) {
            Element h = headings.get(i);
            Element num = h.selectFirst(".h_number");
            if (num == null || !CODE.matcher(num.text().trim()).matches()) continue;
            if (!num.text().contains(".")) continue; // top level chapters are too broad
            Element copy = h.clone();
            copy.select(".h_number").remove();
            String title = copy.text().replaceFirst("^\\d+\\.\\s*", "").trim();
            if (title.isEmpty() || title.split("\\s+").length > 5) continue;
            if (GENERIC_HEADINGS.contains(title.toLowerCase(Locale.ROOT))) continue;
            if (title.toLowerCase(Locale.ROOT).startsWith("start of") || title.toLowerCase(Locale.ROOT).startsWith("end of")) continue;
            String key = Keys.glossary(title);
            if (glossary.containsKey(key)) continue;
            String text = sectionText(h, i + 1 < headings.size() ? headings.get(i + 1) : null);
            if (text.isBlank()) continue;
            glossary.put(key, new GlossaryEntry(key, titleCase(title), List.of(), GlossaryKind.RULE_TERM,
                    RulesText.of(text.length() > MAX_TEXT ? text.substring(0, MAX_TEXT) + " ..." : text), List.of(), List.of()));
            report.count("core", "glossary");
        }

        List<BattleSize> sizes = battleSizes(doc, report);
        return new Result(new ArrayList<>(glossary.values()), sizes);
    }

    /** Text between a heading and the next heading, in document order (text nodes included). */
    private static String sectionText(Element heading, Element next) {
        StringBuilder html = new StringBuilder();
        org.jsoup.nodes.Node n = heading.nextSibling();
        int guard = 0;
        while (n != null && guard++ < 400) {
            if (n instanceof Element e) {
                if (e == next || e.is("h2, h3") || (next != null && e.getAllElements().contains(next))) break;
                // Ability blocks are glossary entries of their own.
                if (!e.is(".abWrap") && e.select(".abWrap").isEmpty()) html.append(e.outerHtml());
            } else if (n instanceof org.jsoup.nodes.TextNode t) {
                html.append(org.jsoup.nodes.Entities.escape(t.getWholeText()));
            }
            n = n.nextSibling();
        }
        return TextCleaner.html(html.toString());
    }

    // ---- battle sizes ---------------------------------------------------------------------------

    private static final Pattern DOUBLE_RULE = Pattern.compile("unit limit for (\\w+) and (\\w+(?: \\w+)?) units is double", Pattern.CASE_INSENSITIVE);
    private static final Pattern EPIC_RULE = Pattern.compile("every (\\w+(?: \\w+)?) has a unit limit of (\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern UPGRADE_RULE = Pattern.compile("include up to (\\w+) of the same Upgrade", Pattern.CASE_INSENSITIVE);
    private static final Pattern SINGLE_DET = Pattern.compile("playing an? (\\w+(?: \\w+)?) battle, you can select an? (\\d+) ?DP detachment as your only detachment", Pattern.CASE_INSENSITIVE);

    private static List<BattleSize> battleSizes(Document doc, ImportReport.Collector report) {
        Element anchor = doc.getElementById("Select-Battle-Size");
        Element table = null;
        if (anchor != null) {
            for (Element t : doc.select("table")) {
                if (t.text().toUpperCase(Locale.ROOT).contains("BATTLE SIZE") && t.siblingIndex() >= 0) {
                    table = t;
                    break;
                }
            }
        }
        if (table == null) {
            report.warn("battle-sizes", "Battle size table not found on the core rules page", "core", null);
            return List.of();
        }
        List<String> header = new ArrayList<>();
        List<List<String>> rows = new ArrayList<>();
        for (Element tr : table.select("tr")) {
            List<String> cells = new ArrayList<>();
            for (Element td : tr.select("td, th")) cells.add(td.text().replace("­", "").trim());
            while (!cells.isEmpty() && cells.get(0).isEmpty()) cells.remove(0);
            if (cells.isEmpty()) continue;
            if (cells.get(0).toUpperCase(Locale.ROOT).contains("BATTLE SIZE")) header = cells;
            else rows.add(cells);
        }
        int pts = column(header, "points"), dp = column(header, "detachment"), enh = column(header, "enhancement"), unit = column(header, "unit limit");
        String around = doc.text();
        Matcher dbl = DOUBLE_RULE.matcher(around);
        boolean doubles = dbl.find();
        Matcher epic = EPIC_RULE.matcher(around);
        Optional<Integer> epicLimit = epic.find() ? Optional.of(Integer.parseInt(epic.group(2))) : Optional.empty();
        Matcher upg = UPGRADE_RULE.matcher(around);
        Optional<Integer> sameUpgrade = upg.find() ? number(upg.group(1)) : Optional.empty();
        Matcher single = SINGLE_DET.matcher(around);
        Map<String, Integer> singleDetachment = new LinkedHashMap<>();
        while (single.find()) singleDetachment.put(Keys.slug(single.group(1)), Integer.parseInt(single.group(2)));

        List<BattleSize> out = new ArrayList<>();
        for (List<String> r : rows) {
            String name = titleCase(r.get(0));
            Map<String, Integer> limits = new LinkedHashMap<>();
            Optional<Integer> points = cell(r, pts);
            Optional<Integer> dpBudget = cell(r, dp);
            cell(r, enh).ifPresent(v -> limits.put(BattleSize.LIMIT_ENHANCEMENTS, v));
            Optional<Integer> unitLimit = cell(r, unit);
            unitLimit.ifPresent(v -> {
                limits.put(BattleSize.LIMIT_MAX_COPIES, v);
                if (doubles) {
                    limits.put(BattleSize.LIMIT_MAX_COPIES_BATTLELINE, v * 2);
                    limits.put(BattleSize.LIMIT_MAX_COPIES_DEDICATED_TRANSPORT, v * 2);
                }
            });
            epicLimit.ifPresent(v -> limits.put(BattleSize.LIMIT_MAX_COPIES_EPIC_HERO, v));
            sameUpgrade.ifPresent(v -> limits.put(BattleSize.LIMIT_MAX_SAME_UPGRADE, v));
            Integer sd = singleDetachment.get(Keys.slug(name));
            if (sd != null) limits.put(BattleSize.LIMIT_SINGLE_DETACHMENT_DP, sd);
            if (points.isEmpty()) report.warn("battle-sizes", "No points total for battle size " + name, "core", name);
            out.add(new BattleSize(Keys.battleSize(name), name, points, dpBudget, limits));
            report.count("core", "battle_size");
        }
        if (!doubles) report.warn("battle-sizes", "Battleline / dedicated transport unit limit rule not found", "core", null);
        if (epicLimit.isEmpty()) report.warn("battle-sizes", "Epic hero unit limit rule not found", "core", null);
        return out;
    }

    private static int column(List<String> header, String needle) {
        for (int i = 0; i < header.size(); i++) {
            if (header.get(i).toLowerCase(Locale.ROOT).replace("­", "").contains(needle)) return i;
        }
        return -1;
    }

    private static Optional<Integer> cell(List<String> row, int col) {
        if (col < 0 || col >= row.size()) return Optional.empty();
        String v = row.get(col).replaceAll("[^0-9]", "");
        return v.isEmpty() ? Optional.empty() : Optional.of(Integer.parseInt(v));
    }

    private static Optional<Integer> number(String word) {
        return switch (word.toLowerCase(Locale.ROOT)) {
            case "one" -> Optional.of(1);
            case "two" -> Optional.of(2);
            case "three" -> Optional.of(3);
            case "four" -> Optional.of(4);
            case "five" -> Optional.of(5);
            default -> word.matches("\\d+") ? Optional.of(Integer.parseInt(word)) : Optional.empty();
        };
    }

    /** "LETHAL HITS" -> "Lethal Hits", "TWIN-LINKED" -> "Twin-linked"; mixed case input is kept. */
    public static String titleCase(String s) {
        String t = s.trim().replaceAll("\\s+", " ");
        if (!t.equals(t.toUpperCase(Locale.ROOT)) && !t.equals(t.toLowerCase(Locale.ROOT))) return t;
        StringBuilder out = new StringBuilder();
        boolean start = true;
        for (char c : t.toLowerCase(Locale.ROOT).toCharArray()) {
            out.append(start ? Character.toUpperCase(c) : c);
            start = c == ' ' || c == '(' || c == '/';
        }
        return out.toString();
    }
}
