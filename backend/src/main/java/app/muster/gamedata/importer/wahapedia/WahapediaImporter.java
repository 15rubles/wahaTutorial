package app.muster.gamedata.importer.wahapedia;

import app.muster.common.ApiException;
import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.build.Keys;
import app.muster.gamedata.build.PhaseInference;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.importer.SafeZip;
import app.muster.gamedata.importer.TextCleaner;
import app.muster.gamedata.importer.wahapedia.WahapediaCsv.Row;
import app.muster.gamedata.importer.wahapedia.WahapediaCsv.Table;
import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.AbilityOwner;
import app.muster.gamedata.model.ArmyRule;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.ForceDisposition;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.gamedata.model.KeywordRef;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.PointsTier;
import app.muster.gamedata.model.RulesText;
import app.muster.gamedata.model.Source;
import app.muster.gamedata.model.StatProfile;
import app.muster.gamedata.model.Stratagem;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearCost;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.model.Weapon;
import app.muster.gamedata.model.WeaponType;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

/**
 * Maps the Wahapedia data export (pipe-separated CSV files, plus the optional core rules page) to a
 * {@link SourceSet}. Every row that cannot be mapped is listed in the report.
 */
@Component
public class WahapediaImporter {

    public static final List<String> CSV_FILES = List.of(
            "Last_update", "Factions", "Source", "Datasheets", "Datasheets_abilities", "Datasheets_keywords",
            "Datasheets_models", "Datasheets_options", "Datasheets_wargear", "Datasheets_unit_composition",
            "Datasheets_models_cost", "Datasheets_enhancements", "Datasheets_leader", "Stratagems", "Abilities",
            "Enhancements", "Detachment_abilities", "Detachments", "Detachments_chapter_dp");
    public static final List<String> REQUIRED = List.of("Factions", "Datasheets");
    public static final String CORE_RULES_FILE = "core-rules.html";

    private static final Pattern TIER = Pattern.compile(
            "YOUR (?:(\\d+)(?:ST|ND|RD|TH)(?: TO (\\d+)(?:ST|ND|RD|TH))?(\\+)? )?UNITS? COSTS?", Pattern.CASE_INSENSITIVE);
    private static final Pattern MODELS = Pattern.compile("^(?:(\\d+)\\s*-\\s*)?(\\d+)\\s+models?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern MODEL_ONLY = Pattern.compile("^(.{1,160}?)\\bmodels? only\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern SECTION = Pattern.compile(
            "<b>\\s*(WHEN|TARGET|EFFECT|RESTRICTIONS)\\s*:\\s*</b>", Pattern.CASE_INSENSITIVE);

    /** Reads a zip with the CSV files (and optionally core-rules.html). */
    public SourceSet importZip(byte[] zip) {
        Map<String, byte[]> files = SafeZip.read(zip, ".csv", ".html", ".htm");
        return parse(files);
    }

    /** {@code files}: file name (for example "Datasheets.csv") -> bytes. */
    public SourceSet parse(Map<String, byte[]> files) {
        Map<String, Table> tables = new HashMap<>();
        ImportReport.Collector report = new ImportReport.Collector();
        for (var e : files.entrySet()) {
            String n = e.getKey();
            if (!n.toLowerCase(Locale.ROOT).endsWith(".csv")) continue;
            String name = n.substring(0, n.length() - 4);
            Table t = WahapediaCsv.parse(name, e.getValue());
            t.malformed().forEach(m -> report.error("malformed-record", name + ".csv " + m, null, name));
            tables.put(name, t);
        }
        for (String req : REQUIRED) {
            if (!tables.containsKey(req)) {
                throw ApiException.badRequest("WAHAPEDIA_LAYOUT", "The Wahapedia export is missing " + req + ".csv");
            }
        }
        for (String f : CSV_FILES) {
            if (!tables.containsKey(f)) report.warn("missing-file", f + ".csv is not in the upload", null, f);
        }
        Optional<String> coreRules = files.entrySet().stream()
                .filter(e -> e.getKey().toLowerCase(Locale.ROOT).endsWith(".html") || e.getKey().toLowerCase(Locale.ROOT).endsWith(".htm"))
                .map(e -> new String(e.getValue(), StandardCharsets.UTF_8))
                .findFirst();
        if (coreRules.isEmpty()) report.warn("missing-file", "core-rules.html is not in the upload: no weapon abilities, rule terms or battle sizes", null, null);
        return new Run(tables, coreRules, report).run();
    }

    private static final class Run {
        final Map<String, Table> tables;
        final Optional<String> coreRules;
        final ImportReport.Collector report;
        final SourceSet.Builder out;

        final Map<String, String> factionKeyById = new HashMap<>();
        final Map<String, String> sheetKeyById = new HashMap<>();
        final Map<String, String> sheetNameById = new HashMap<>();
        final Map<String, String> nameByKey = new HashMap<>();
        final Map<String, String> detachmentKeyById = new HashMap<>();
        final Set<String> skippedDetachments = new java.util.HashSet<>();
        final Map<String, Row> abilityById = new HashMap<>();
        final Map<String, String> armyRuleKeys = new HashMap<>();
        final Set<String> legendsSources = new java.util.HashSet<>();

        Run(Map<String, Table> tables, Optional<String> coreRules, ImportReport.Collector report) {
            this.tables = tables;
            this.coreRules = coreRules;
            this.report = report;
            this.out = new SourceSet.Builder(Source.WAHAPEDIA, report);
        }

        List<Row> rows(String table) {
            Table t = tables.get(table);
            return t == null ? List.of() : t.rows();
        }

        Map<String, List<Row>> groupBy(String table, String column) {
            Map<String, List<Row>> map = new LinkedHashMap<>();
            for (Row r : rows(table)) map.computeIfAbsent(r.get(column), k -> new ArrayList<>()).add(r);
            map.values().forEach(l -> l.sort(Comparator.comparingInt(r -> r.integer("line").orElse(0))));
            return map;
        }

        SourceSet run() {
            coreRules.ifPresent(html -> {
                CoreRulesParser.Result core = CoreRulesParser.parse(html, report);
                for (GlossaryEntry g : core.glossary()) out.add(g, null);
                for (BattleSize b : core.battleSizes()) out.add(b, null);
            });
            for (Row r : rows("Abilities")) abilityById.put(r.get("id"), r);
            for (Row r : rows("Abilities")) {
                if (r.get("faction_id").isEmpty()) {
                    String term = r.get("name");
                    if (!out.contains(EntityType.GLOSSARY, Keys.glossary(term))) {
                        out.add(new GlossaryEntry(Keys.glossary(term), term, List.of(), GlossaryKind.CORE_ABILITY,
                                text(r.get("description")), List.of(), List.of()), r.get("id"));
                        report.count("core", "glossary");
                    }
                }
            }
            for (Row r : rows("Source")) {
                if (r.get("name").toLowerCase(Locale.ROOT).contains("legends")) legendsSources.add(r.get("id"));
            }
            factions();
            datasheets();
            detachments();
            enhancements();
            stratagems();
            return out.build();
        }

        // ---- factions ---------------------------------------------------------------------------

        final Map<String, String> chapterFactionKey = new HashMap<>(); // chapter keyword (lower) -> faction key
        final Map<String, String> chapterParentFactionId = new HashMap<>();

        void factions() {
            for (Row r : rows("Factions")) {
                String key = Keys.faction(r.get("name"));
                factionKeyById.put(r.get("id"), key);
                out.add(new Faction(key, r.get("name"), Optional.empty(), Optional.empty()), r.get("id"));
                report.count(key, "faction");
            }
            // Chapters: keywords with their own detachment point costs are sub-factions of the detachment's faction.
            Map<String, Row> detachments = new HashMap<>();
            for (Row d : rows("Detachments")) detachments.put(d.get("id"), d);
            for (Row r : rows("Detachments_chapter_dp")) {
                Row d = detachments.get(r.get("detachment_id"));
                if (d == null) continue;
                String parentKey = factionKeyById.get(d.get("faction_id"));
                String keyword = r.get("keyword");
                if (parentKey == null || keyword.isEmpty()) continue;
                String lower = keyword.toLowerCase(Locale.ROOT);
                if (chapterFactionKey.containsKey(lower)) continue;
                String key = Keys.faction(keyword);
                if (factionKeyById.containsValue(key)) continue;
                chapterFactionKey.put(lower, key);
                chapterParentFactionId.put(lower, d.get("faction_id"));
                out.add(new Faction(key, keyword, Optional.of(parentKey), Optional.empty()), null);
                report.count(key, "faction");
            }
        }

        // ---- datasheets -------------------------------------------------------------------------

        void datasheets() {
            Map<String, List<Row>> keywords = groupBy("Datasheets_keywords", "datasheet_id");
            Map<String, List<Row>> models = groupBy("Datasheets_models", "datasheet_id");
            Map<String, List<Row>> abilities = groupBy("Datasheets_abilities", "datasheet_id");
            Map<String, List<Row>> wargear = groupBy("Datasheets_wargear", "datasheet_id");
            Map<String, List<Row>> options = groupBy("Datasheets_options", "datasheet_id");
            Map<String, List<Row>> composition = groupBy("Datasheets_unit_composition", "datasheet_id");
            Map<String, List<Row>> costs = groupBy("Datasheets_models_cost", "datasheet_id");
            Map<String, List<Row>> leaders = new LinkedHashMap<>();
            for (Row r : rows("Datasheets_leader")) leaders.computeIfAbsent(r.get("leader_id"), k -> new ArrayList<>()).add(r);

            List<Row> sheets = rows("Datasheets");
            // A Legends datasheet sharing its name with a current one keeps a separate key.
            java.util.Set<String> current = new java.util.HashSet<>();
            for (Row r : sheets) {
                if (!legendsSources.contains(r.get("source_id"))) current.add(r.get("faction_id") + "|" + Keys.slug(cleanName(r.get("name"))));
            }
            // First pass: keys, so leaders can point at units listed later.
            Map<String, Row> byId = new LinkedHashMap<>();
            for (Row r : sheets) {
                if (r.flag("virtual")) {
                    report.info("virtual-datasheet", "Skipped virtual datasheet '" + r.get("name") + "'", null, r.get("id"));
                    continue;
                }
                String factionKey = factionKeyById.get(r.get("faction_id"));
                if (factionKey == null) {
                    report.warn("orphan-reference", "Datasheet '" + r.get("name") + "' has unknown faction " + r.get("faction_id"), null, r.get("id"));
                    continue;
                }
                for (Row k : keywords.getOrDefault(r.get("id"), List.of())) {
                    String chapter = chapterFactionKey.get(k.get("keyword").toLowerCase(Locale.ROOT));
                    if (chapter != null && k.flag("is_faction_keyword") && r.get("faction_id").equals(chapterParentFactionId.get(k.get("keyword").toLowerCase(Locale.ROOT)))) {
                        factionKey = chapter;
                    }
                }
                boolean legendsTwin = legendsSources.contains(r.get("source_id"))
                        && current.contains(r.get("faction_id") + "|" + Keys.slug(cleanName(r.get("name"))));
                String keyName = cleanName(r.get("name")) + (legendsTwin ? " legends" : "");
                sheetKeyById.put(r.get("id"), Keys.datasheet(factionKey, keyName));
                nameByKey.put(Keys.datasheet(factionKey, keyName), cleanName(r.get("name")));
                sheetNameById.put(r.get("id"), cleanName(r.get("name")));
                byId.put(r.get("id"), r);
            }

            for (Row r : byId.values()) {
                String id = r.get("id");
                String key = sheetKeyById.get(id);
                String factionKey = key.substring(0, key.indexOf(':'));
                String name = sheetNameById.get(id);

                List<String> kws = new ArrayList<>();
                List<String> fkws = new ArrayList<>();
                for (Row k : keywords.getOrDefault(id, List.of())) {
                    String kw = k.get("keyword");
                    if (kw.isEmpty()) continue;
                    List<String> target = k.flag("is_faction_keyword") ? fkws : kws;
                    if (target.stream().noneMatch(x -> x.equalsIgnoreCase(kw))) target.add(kw);
                }

                List<StatProfile> profiles = new ArrayList<>();
                for (Row m : models.getOrDefault(id, List.of())) {
                    String inv = m.get("inv_sv");
                    Optional<String> invuln = inv.matches("\\d") ? Optional.of(inv + "+") : (inv.matches("\\d\\+") ? Optional.of(inv) : Optional.empty());
                    profiles.add(new StatProfile(m.get("name").isEmpty() ? name : m.get("name"), m.get("M"), m.get("T"), m.get("Sv"),
                            invuln, m.get("W"), m.get("Ld"), m.get("OC")));
                }
                if (profiles.isEmpty()) report.warn("no-profile", "Datasheet '" + name + "' has no model profile", factionKey, key);

                List<String> leaderOf = new ArrayList<>();
                for (Row l : leaders.getOrDefault(id, List.of())) {
                    String target = sheetKeyById.get(l.get("attached_id"));
                    if (target == null) report.warn("orphan-reference", "Leader '" + name + "' points at unknown datasheet " + l.get("attached_id"), factionKey, key);
                    else if (!leaderOf.contains(target)) leaderOf.add(target);
                }

                Optional<String> comp = Optional.of(String.join("\n", composition.getOrDefault(id, List.of()).stream()
                        .map(c -> TextCleaner.html(c.get("description"))).filter(s -> !s.isBlank()).toList())).filter(s -> !s.isBlank());
                Optional<String> loadout = Optional.of(TextCleaner.html(r.get("loadout"))).filter(s -> !s.isBlank());
                boolean legends = legendsSources.contains(r.get("source_id"));

                CostParse cost = parseCosts(key, factionKey, costs.getOrDefault(id, List.of()));
                Datasheet d = new Datasheet(key, factionKey, name, r.opt("role"), kws, fkws, profiles, legends, leaderOf,
                        Optional.empty(), comp, loadout, r.flag("is_support"), cost.wargear());
                if (!out.add(d, id)) continue;
                report.count(factionKey, "datasheet");
                for (UnitSizeOption u : cost.sizes()) {
                    out.add(u, null);
                    report.count(factionKey, "unit_size");
                }
                if (cost.sizes().isEmpty()) report.warn("no-points", "Datasheet '" + name + "' has no unit costs", factionKey, key);

                datasheetAbilities(r, key, factionKey, abilities.getOrDefault(id, List.of()), leaderOf);
                weapons(key, factionKey, wargear.getOrDefault(id, List.of()));
                int n = 0;
                for (Row o : options.getOrDefault(id, List.of())) {
                    n++;
                    String desc = TextCleaner.html(o.get("description"));
                    if (desc.isBlank()) continue;
                    List<String> choices = new ArrayList<>();
                    for (Element li : Jsoup.parseBodyFragment(o.get("description")).select("li")) choices.add(li.text().replaceFirst("^\\d+\\s+", "").trim());
                    out.add(new WargearOption(Keys.child(key, "opt", "line " + o.get("line")), key, "Wargear option " + n, desc, choices,
                            Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty()), null);
                    report.count(factionKey, "wargear_option");
                }
            }
        }

        static String cleanName(String raw) {
            return TextCleaner.html(raw).replaceAll("(?i)\\s*\\[legends]\\s*", " ").trim();
        }

        record CostParse(List<UnitSizeOption> sizes, List<WargearCost> wargear) {}

        /**
         * Cost rows are a small document: tier headers ("YOUR 1ST TO 2ND UNITS COST"), optional pricing
         * context headers, optional composition headers, size lines ("10 models | 85") and a
         * "WARGEAR OPTIONS" block ("per Lascannon | 10").
         */
        CostParse parseCosts(String sheetKey, String factionKey, List<Row> lines) {
            Map<String, String> names = new LinkedHashMap<>();
            Map<String, Integer> models = new LinkedHashMap<>();
            Map<String, List<PointsTier>> tiers = new LinkedHashMap<>();
            List<WargearCost> wargear = new ArrayList<>();
            int from = 1;
            Optional<Integer> to = Optional.empty();
            Optional<String> context = Optional.empty();
            List<String> compParts = new ArrayList<>();
            boolean wargearMode = false;
            for (Row l : lines) {
                String raw = l.get("description");
                String desc = TextCleaner.html(raw).trim();
                Optional<Integer> cost = l.integer("cost");
                if (raw.contains("dsHeaderComp")) {
                    compParts.add(desc);
                    continue;
                }
                if (raw.contains("dsHeader")) {
                    context = Optional.of(desc);
                    wargearMode = false;
                    continue;
                }
                if (desc.equalsIgnoreCase("WARGEAR OPTIONS")) {
                    wargearMode = true;
                    continue;
                }
                Matcher t = TIER.matcher(desc);
                if (t.matches()) {
                    wargearMode = false;
                    from = t.group(1) == null ? 1 : Integer.parseInt(t.group(1));
                    if (t.group(1) == null || t.group(3) != null) to = Optional.empty();
                    else to = Optional.of(t.group(2) == null ? from : Integer.parseInt(t.group(2)));
                    continue;
                }
                if (wargearMode) {
                    if (cost.isPresent()) wargear.add(new WargearCost(desc.replaceFirst("(?i)^per\\s+", "").trim(), cost.get()));
                    else report.warn("unparsed-cost", "Wargear cost line without points: '" + desc + "'", factionKey, sheetKey);
                    continue;
                }
                Matcher m = MODELS.matcher(desc);
                if (!m.matches() || cost.isEmpty()) {
                    report.warn("unparsed-cost", "Cost line not understood: '" + desc + "'", factionKey, sheetKey);
                    compParts.clear();
                    continue;
                }
                int count = Integer.parseInt(m.group(2));
                String comp = String.join(", ", compParts);
                compParts.clear();
                String id = comp.isEmpty() ? String.valueOf(count) : count + "-" + Keys.slug(comp);
                names.putIfAbsent(id, desc + (comp.isEmpty() ? "" : " (" + comp + ")"));
                models.putIfAbsent(id, count);
                tiers.computeIfAbsent(id, k -> new ArrayList<>()).add(new PointsTier(from, to, cost.get(), context));
            }
            List<UnitSizeOption> sizes = new ArrayList<>();
            for (var e : names.entrySet()) {
                List<PointsTier> t = tiers.get(e.getKey());
                Optional<String> firstContext = t.stream().map(PointsTier::context).flatMap(Optional::stream).findFirst();
                Optional<Integer> first = t.stream()
                        .filter(x -> x.covers(1) && x.context().equals(firstContext))
                        .map(PointsTier::points).findFirst();
                boolean simple = t.size() == 1 && t.get(0).fromCopy() == 1 && t.get(0).toCopy().isEmpty() && t.get(0).context().isEmpty();
                String key = e.getKey().contains("-") ? sheetKey + ":size:" + e.getKey() : Keys.unitSize(sheetKey, models.get(e.getKey()));
                sizes.add(new UnitSizeOption(key, sheetKey, e.getValue(), models.get(e.getKey()), first, simple ? List.of() : t));
            }
            return new CostParse(sizes, wargear);
        }

        void datasheetAbilities(Row sheet, String key, String factionKey, List<Row> rows, List<String> leaderOf) {
            for (Row a : rows) {
                String type = a.get("type");
                String name;
                String body;
                Optional<String> glossary = Optional.empty();
                if (!a.get("ability_id").isEmpty()) {
                    Row ref = abilityById.get(a.get("ability_id"));
                    if (ref == null) {
                        report.warn("orphan-reference", "Ability " + a.get("ability_id") + " of " + key + " is not in Abilities.csv", factionKey, key);
                        continue;
                    }
                    name = ref.get("name");
                    body = ref.get("description");
                    if (ref.get("faction_id").isEmpty()) {
                        glossary = Optional.of(Keys.glossary(name));
                    } else if (type.equalsIgnoreCase("Faction")) {
                        armyRule(ref);
                    }
                    String param = a.get("parameter");
                    if (!param.isEmpty()) name = name + " " + (param.matches("\\d+") && name.toLowerCase(Locale.ROOT).contains("scout") ? param + "\"" : param);
                } else {
                    name = TextCleaner.html(a.get("name"));
                    body = a.get("description");
                }
                if (name.isBlank()) continue;
                String abKey = Keys.child(key, "ab", name);
                if (out.contains(EntityType.ABILITY, abKey)) continue;
                out.add(new Ability(abKey, AbilityOwner.DATASHEET, key, Optional.of(factionKey), name, text(body), PhaseTags.NONE, glossary), null);
                report.count(factionKey, "ability");
            }
            if (!sheet.get("damaged_w").isEmpty()) {
                String name = "Damaged: " + sheet.get("damaged_w") + " wounds remaining";
                out.add(new Ability(Keys.child(key, "ab", "damaged"), AbilityOwner.DATASHEET, key, Optional.of(factionKey), name,
                        text(sheet.get("damaged_description")), PhaseTags.NONE, Optional.of(Keys.glossary("Damaged"))), null);
            }
            if (!sheet.get("transport").isEmpty()) {
                out.add(new Ability(Keys.child(key, "ab", "transport"), AbilityOwner.DATASHEET, key, Optional.of(factionKey), "Transport",
                        text(sheet.get("transport")), PhaseTags.NONE, Optional.empty()), null);
            }
            if (!leaderOf.isEmpty() || !sheet.get("leader_head").isEmpty()) {
                StringBuilder sb = new StringBuilder(TextCleaner.html(sheet.get("leader_head")));
                for (String target : leaderOf) {
                    sb.append("\n• ").append(nameByKey.getOrDefault(target, target));
                }
                String footer = TextCleaner.html(sheet.get("leader_footer"));
                if (!footer.isBlank()) sb.append("\n\n").append(footer);
                String abKey = Keys.child(key, "ab", "leader-units");
                out.add(new Ability(abKey, AbilityOwner.DATASHEET, key, Optional.of(factionKey), "Leader: units it can lead",
                        RulesText.of(sb.toString().strip()), PhaseTags.NONE, Optional.of(Keys.glossary("Leader"))), null);
            }
        }

        void armyRule(Row ref) {
            String factionKey = factionKeyById.get(ref.get("faction_id"));
            if (factionKey == null) return;
            String id = factionKey + "|" + ref.get("name");
            if (armyRuleKeys.containsKey(id)) return;
            String key = Keys.child(factionKey, "rule", ref.get("name"));
            armyRuleKeys.put(id, key);
            RulesText t = text(ref.get("description"));
            out.add(new ArmyRule(key, factionKey, ref.get("name"), t), ref.get("id"));
            out.add(new Ability(Keys.child(key, "ab", ref.get("name")), AbilityOwner.ARMY_RULE, key, Optional.of(factionKey),
                    ref.get("name"), t, PhaseTags.NONE, Optional.empty()), null);
            String g = Keys.glossary(ref.get("name"));
            if (!out.contains(EntityType.GLOSSARY, g)) {
                out.add(new GlossaryEntry(g, ref.get("name"), List.of(), GlossaryKind.RULE_TERM, t, List.of(), List.of()), ref.get("id"));
            }
            report.count(factionKey, "army_rule");
        }

        void weapons(String key, String factionKey, List<Row> rows) {
            for (Row w : rows) {
                String type = w.get("type");
                String name = TextCleaner.html(w.get("name"));
                if (type.isEmpty()) {
                    report.info("wargear-without-profile", "Wargear '" + name + "' of " + key + " has no profile", factionKey, key);
                    continue;
                }
                boolean melee = type.equalsIgnoreCase("Melee");
                String wKey = Keys.child(key, "w", name + (melee ? " melee" : ""));
                if (out.contains(EntityType.WEAPON, wKey)) continue;
                List<KeywordRef> kws = new ArrayList<>();
                for (String k : TextCleaner.html(w.get("description")).split(",")) {
                    String label = keywordLabel(k);
                    if (!label.isEmpty() && !label.equals("-")) kws.add(KeywordRef.of(label));
                }
                String range = w.get("range");
                if (range.matches("\\d+")) range = range + "\"";
                String skill = w.get("BS_WS");
                if (skill.matches("\\d")) skill = skill + "+";
                out.add(new Weapon(wKey, key, name, melee ? WeaponType.MELEE : WeaponType.RANGED, melee && range.isEmpty() ? "Melee" : range,
                        w.get("A"), skill, w.get("S"), w.get("AP"), w.get("D"), kws), null);
                report.count(factionKey, "weapon");
            }
        }

        /** "rapid fire 1" -> "Rapid Fire 1"; "LETHAL HITS: non-MONSTER/VEHICLE" keeps its condition. */
        static String keywordLabel(String raw) {
            String k = raw.trim();
            if (k.isEmpty()) return k;
            int colon = k.indexOf(':');
            String head = colon < 0 ? k : k.substring(0, colon);
            String tail = colon < 0 ? "" : k.substring(colon);
            return CoreRulesParser.titleCase(head) + tail;
        }

        // ---- detachments, enhancements, stratagems ------------------------------------------------

        void detachments() {
            Map<String, List<Row>> rules = groupBy("Detachment_abilities", "detachment_id");
            Map<String, Map<String, Integer>> chapterDp = new HashMap<>();
            for (Row r : rows("Detachments_chapter_dp")) {
                r.integer("dp").ifPresent(dp -> chapterDp.computeIfAbsent(r.get("detachment_id"), k -> new LinkedHashMap<>()).put(r.get("keyword"), dp));
            }
            Set<String> dispositions = new LinkedHashSet<>();
            for (Row d : rows("Detachments")) {
                if (d.get("type").toLowerCase(Locale.ROOT).contains("boarding")) {
                    skippedDetachments.add(d.get("id"));
                    skippedDetachments.add(d.get("name").toLowerCase(Locale.ROOT));
                    report.info("other-game-mode", "Skipped " + d.get("type") + " detachment '" + d.get("name") + "'", null, d.get("id"));
                    continue;
                }
                String factionKey = factionKeyById.get(d.get("faction_id"));
                if (factionKey == null) {
                    report.warn("orphan-reference", "Detachment '" + d.get("name") + "' has unknown faction " + d.get("faction_id"), null, d.get("id"));
                    continue;
                }
                String key = Keys.detachment(factionKey, d.get("name"));
                List<Row> rs = rules.getOrDefault(d.get("id"), List.of());
                StringBuilder text = new StringBuilder();
                for (Row r : rs) {
                    if (text.length() > 0) text.append("\n\n");
                    if (rs.size() > 1) text.append(r.get("name")).append('\n');
                    text.append(TextCleaner.html(r.get("description")));
                }
                List<String> fds = new ArrayList<>();
                for (String f : d.get("force_disposition").split(",")) {
                    if (!f.isBlank()) {
                        fds.add(f.trim());
                        dispositions.add(f.trim());
                    }
                }
                Optional<String> ruleName = rs.isEmpty() ? Optional.empty() : Optional.of(rs.get(0).get("name"));
                if (!out.add(new Detachment(key, factionKey, d.get("name"), d.integer("dp"), List.of(), ruleName, RulesText.of(text.toString()),
                        Optional.empty(), fds, chapterDp.getOrDefault(d.get("id"), Map.of())), d.get("id"))) continue;
                detachmentKeyById.put(d.get("id"), key);
                report.count(factionKey, "detachment");
                for (Row r : rs) {
                    out.add(new Ability(Keys.child(key, "ab", r.get("name")), AbilityOwner.DETACHMENT, key, Optional.of(factionKey),
                            r.get("name"), text(r.get("description")), PhaseTags.NONE, Optional.empty()), r.get("id"));
                }
            }
            for (String fd : dispositions) {
                out.add(new ForceDisposition(Keys.forceDisposition(fd), fd, RulesText.EMPTY), null);
            }
            if (!dispositions.isEmpty()) {
                report.info("force-disposition-text", dispositions.size() + " force dispositions have no rules text in the export; add it in the admin editor", "core", null);
            }
        }

        void enhancements() {
            Map<String, List<String>> eligible = new HashMap<>();
            for (Row r : rows("Datasheets_enhancements")) {
                String sheet = sheetKeyById.get(r.get("datasheet_id"));
                if (sheet != null) eligible.computeIfAbsent(r.get("enhancement_id"), k -> new ArrayList<>()).add(sheet);
            }
            Map<String, String> sheetByName = new HashMap<>();
            sheetKeyById.forEach((id, key) -> sheetByName.putIfAbsent(key.substring(0, key.indexOf(':')) + "|" + Keys.matchName(sheetNameById.get(id)), key));
            for (Row e : rows("Enhancements")) {
                String detKey = detachmentKeyById.get(e.get("detachment_id"));
                if (detKey == null && skipped(e.get("detachment_id"), e.get("detachment"))) {
                    report.info("other-game-mode", "Skipped enhancement '" + e.get("name") + "' of " + e.get("detachment"), null, e.get("id"));
                    continue;
                }
                if (detKey == null) {
                    report.warn("orphan-reference", "Enhancement '" + e.get("name") + "' has no known detachment (" + e.get("detachment") + ")", null, e.get("id"));
                    continue;
                }
                String factionKey = detKey.substring(0, detKey.indexOf(':'));
                List<String> required = new ArrayList<>();
                String desc = e.get("description");
                Matcher m = MODEL_ONLY.matcher(TextCleaner.html(desc));
                int only = desc.indexOf(" only");
                if (m.find() && only > 0) {
                    org.jsoup.nodes.Document frag = Jsoup.parseBodyFragment(desc.substring(0, only));
                    StringBuilder kw = new StringBuilder();
                    for (Element span : frag.select("span.kwb")) {
                        if (kw.length() > 0) kw.append(' ');
                        kw.append(span.text().trim());
                    }
                    if (kw.length() > 0) required.add(CoreRulesParser.titleCase(kw.toString()));
                }
                List<String> leads = new ArrayList<>();
                for (Element a : Jsoup.parseBodyFragment(e.get("support_leader")).select("a")) {
                    String target = sheetByName.get(factionKey + "|" + Keys.matchName(a.text()));
                    if (target == null) {
                        // Chapter units live under a sub-faction key; search every faction of this import.
                        target = sheetByName.entrySet().stream().filter(x -> x.getKey().endsWith("|" + Keys.matchName(a.text())))
                                .map(Map.Entry::getValue).findFirst().orElse(null);
                    }
                    if (target == null) report.warn("orphan-reference", "Enhancement '" + e.get("name") + "' lets the bearer lead unknown unit '" + a.text() + "'", factionKey, e.get("id"));
                    else leads.add(target);
                }
                String key = Keys.child(detKey, "enh", e.get("name"));
                if (out.add(new Enhancement(key, detKey, factionKey, e.get("name"), e.integer("cost"), required, List.of(), text(desc),
                        PhaseTags.NONE, e.flag("upgrade"), eligible.getOrDefault(e.get("id"), List.of()), leads), e.get("id"))) {
                    report.count(factionKey, "enhancement");
                }
            }
        }

        void stratagems() {
            // Newest rows first, so when the export lists a stratagem twice the current wording is kept.
            List<Row> sorted = new ArrayList<>(rows("Stratagems"));
            sorted.sort(Comparator.comparing((Row r) -> r.get("id")).reversed());
            for (Row s : sorted) {
                String type = s.get("type");
                String name = CoreRulesParser.titleCase(TextCleaner.html(s.get("name")));
                if (type.toLowerCase(Locale.ROOT).contains("boarding")) {
                    report.info("other-game-mode", "Skipped " + type + " stratagem '" + name + "'", null, s.get("id"));
                    continue;
                }
                if (type.toLowerCase(Locale.ROOT).endsWith("ability") || s.get("phase").startsWith("Ability")) {
                    String g = Keys.glossary(name);
                    if (!out.contains(EntityType.GLOSSARY, g)) {
                        out.add(new GlossaryEntry(g, name, List.of(), GlossaryKind.RULE_TERM, text(s.get("description")), List.of(), List.of()), s.get("id"));
                        report.count("core", "glossary");
                    }
                    continue;
                }
                Optional<String> factionKey = Optional.ofNullable(factionKeyById.get(s.get("faction_id")));
                Optional<String> detKey = Optional.ofNullable(detachmentKeyById.get(s.get("detachment_id")));
                boolean armyWide = s.get("detachment").equalsIgnoreCase("Army Rules") && factionKey.isPresent();
                if (detKey.isEmpty() && skipped(s.get("detachment_id"), s.get("detachment"))) {
                    report.info("other-game-mode", "Skipped stratagem '" + name + "' of " + s.get("detachment"), null, s.get("id"));
                    continue;
                }
                if (!s.get("detachment_id").isEmpty() && detKey.isEmpty() && !armyWide) {
                    report.warn("orphan-reference", "Stratagem '" + name + "' belongs to unknown detachment " + s.get("detachment"), factionKey.orElse(null), s.get("id"));
                    continue;
                }
                String key = detKey.map(d -> Keys.child(d, "strat", name)).orElseGet(() ->
                        factionKey.map(f -> Keys.child(f, "strat", name)).orElse(Keys.coreStratagem(name)));
                if (out.contains(EntityType.STRATAGEM, key)) {
                    report.info("superseded", "Older copy of stratagem '" + name + "' skipped (" + type + ")", factionKey.orElse("core"), s.get("id"));
                    continue;
                }
                Map<String, String> parts = sections(s.get("description"));
                Optional<PhaseTags> tags = PhaseInference.fromColumns(s.get("phase"), s.get("turn"));
                if (tags.isEmpty() && !(s.get("phase").isEmpty() && s.get("turn").isEmpty())) {
                    report.info("stratagem-phase", "Phase '" + s.get("phase") + "' / turn '" + s.get("turn") + "' of '" + name + "' not understood", factionKey.orElse("core"), key);
                }
                if (out.add(new Stratagem(key, detKey, factionKey, name, s.integer("cp_cost"), category(type, s.get("detachment")),
                        tags.orElse(PhaseTags.NONE), RulesText.of(parts.getOrDefault("WHEN", "")), RulesText.of(parts.getOrDefault("TARGET", "")),
                        RulesText.of(parts.getOrDefault("EFFECT", "")), RulesText.of(parts.getOrDefault("RESTRICTIONS", "")),
                        text(s.get("description"))), s.get("id"))) {
                    report.count(factionKey.orElse("core"), "stratagem");
                }
            }
        }

        boolean skipped(String detachmentId, String detachmentName) {
            return skippedDetachments.contains(detachmentId) || skippedDetachments.contains(detachmentName.toLowerCase(Locale.ROOT));
        }

        static Optional<String> category(String type, String detachment) {
            String t = type.replace('–', '-').replace('—', '-').trim();
            if (!detachment.isBlank() && t.startsWith(detachment)) t = t.substring(detachment.length()).trim();
            t = t.replaceFirst("^-\\s*", "").replaceFirst("(?i)\\s*Stratagem$", "").trim();
            if (t.toLowerCase(Locale.ROOT).startsWith("core -")) t = t.substring(6).trim();
            int dash = t.lastIndexOf(" - ");
            if (dash >= 0) t = t.substring(dash + 3).trim();
            return t.isEmpty() ? Optional.empty() : Optional.of(t);
        }

        static Map<String, String> sections(String html) {
            Map<String, String> out = new LinkedHashMap<>();
            Matcher m = SECTION.matcher(html);
            List<int[]> marks = new ArrayList<>();
            List<String> names = new ArrayList<>();
            while (m.find()) {
                marks.add(new int[] {m.start(), m.end()});
                names.add(m.group(1).toUpperCase(Locale.ROOT));
            }
            for (int i = 0; i < marks.size(); i++) {
                int end = i + 1 < marks.size() ? marks.get(i + 1)[0] : html.length();
                out.put(names.get(i), TextCleaner.html(html.substring(marks.get(i)[1], end)));
            }
            return out;
        }

        static RulesText text(String html) {
            return RulesText.of(TextCleaner.html(html));
        }
    }
}
