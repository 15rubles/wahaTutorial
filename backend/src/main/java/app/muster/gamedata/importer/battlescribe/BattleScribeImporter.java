package app.muster.gamedata.importer.battlescribe;

import static app.muster.gamedata.importer.battlescribe.BsXml.attr;
import static app.muster.gamedata.importer.battlescribe.BsXml.children;
import static app.muster.gamedata.importer.battlescribe.BsXml.description;
import static app.muster.gamedata.importer.battlescribe.BsXml.flag;
import static app.muster.gamedata.importer.battlescribe.BsXml.intAttr;
import static app.muster.gamedata.importer.battlescribe.BsXml.list;
import static app.muster.gamedata.importer.battlescribe.BsXml.text;

import app.muster.common.ApiException;
import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.build.Keys;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.importer.SafeZip;
import app.muster.gamedata.importer.TextCleaner;
import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.AbilityOwner;
import app.muster.gamedata.model.Allegiance;
import app.muster.gamedata.model.ArmyRule;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.gamedata.model.KeywordRef;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.RulesText;
import app.muster.gamedata.model.Source;
import app.muster.gamedata.model.StatProfile;
import app.muster.gamedata.model.Stratagem;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.model.Weapon;
import app.muster.gamedata.model.WeaponType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * Parses a BattleScribe data set (one .gst plus .cat files, plain or zipped) into a {@link SourceSet}.
 * Everything comes from the files; anything it cannot interpret is listed in the report.
 */
@Component
public class BattleScribeImporter {

    private static final Pattern LEADER_BULLET = Pattern.compile("^\\s*(?:•|-|\\*)\\s*(.+?)\\s*$", Pattern.MULTILINE);
    private static final Pattern INVULN = Pattern.compile("(\\d)\\+");
    private static final Pattern POINTS_IN_NAME = Pattern.compile("(\\d[\\d,.]*)\\s*(?:pts|points?)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ALLEGIANCE_PREFIX = Pattern.compile("^(Imperium|Chaos|Xenos|Aeldari|Tyranids|Unaligned)\\s*-\\s*(.+)$", Pattern.CASE_INSENSITIVE);
    private static final int MAX_DEPTH = 12;

    /** Reads a zip with a .gst and .cat files (also accepts .gstz/.catz inside). */
    public SourceSet importZip(byte[] zip) {
        Map<String, byte[]> files = SafeZip.read(zip, ".gst", ".cat", ".gstz", ".catz");
        Map<String, byte[]> xml = new LinkedHashMap<>();
        files.forEach((name, bytes) -> {
            if (name.toLowerCase(Locale.ROOT).endsWith("z") && SafeZip.isZip(bytes)) {
                xml.put(name.substring(0, name.length() - 1), SafeZip.single(bytes));
            } else {
                xml.put(name, bytes);
            }
        });
        return parse(xml);
    }

    public SourceSet parse(Map<String, byte[]> files) {
        List<Map.Entry<String, byte[]>> gst = files.entrySet().stream().filter(e -> e.getKey().toLowerCase(Locale.ROOT).endsWith(".gst")).toList();
        if (gst.size() != 1) {
            throw ApiException.badRequest("BATTLESCRIBE_LAYOUT", "Expected exactly one .gst file, found " + gst.size());
        }
        return new Run(files).run();
    }

    // ---------------------------------------------------------------------------------------------

    private static final class Catalogue {
        final String file;
        final Element root;
        final String id;
        final String name;
        final boolean library;

        Catalogue(String file, Element root) {
            this.file = file;
            this.root = root;
            this.id = attr(root, "id");
            this.name = attr(root, "name");
            this.library = flag(root, "library");
        }
    }

    private record AbilityInfo(String name, String text, Optional<String> glossaryKey) {}

    private static final class UnitScan {
        final List<Element> unitProfiles = new ArrayList<>();
        final Map<String, Element> weapons = new LinkedHashMap<>();
        final Map<String, AbilityInfo> abilities = new LinkedHashMap<>();
        final List<WargearOption> options = new ArrayList<>();
        final Set<String> visited = new HashSet<>();
    }

    private final class Run {
        final Map<String, byte[]> files;
        final ImportReport.Collector report = new ImportReport.Collector();
        final SourceSet.Builder out = new SourceSet.Builder(Source.BATTLESCRIBE, report);
        final Map<String, Element> byId = new HashMap<>();
        final Map<String, Catalogue> catalogues = new LinkedHashMap<>();
        final Map<String, String> glossaryKeyByRuleId = new HashMap<>();
        final Map<String, GlossaryKind> glossaryKinds = new HashMap<>();
        final Map<String, GlossaryEntry> glossary = new LinkedHashMap<>();
        Element gameSystem;
        String ptsTypeId = "";
        String dpTypeId = "";

        Run(Map<String, byte[]> files) {
            this.files = files;
        }

        SourceSet run() {
            files.forEach((name, bytes) -> {
                Document doc = BsXml.parse(name, bytes);
                Element root = doc.getDocumentElement();
                index(root);
                if (root.getTagName().equals("gameSystem")) gameSystem = root;
                else if (root.getTagName().equals("catalogue")) {
                    Catalogue c = new Catalogue(name, root);
                    catalogues.put(c.id, c);
                } else report.warn("unknown-file", "Ignored " + name + ": root element <" + root.getTagName() + ">", null, name);
            });
            if (gameSystem == null) throw ApiException.badRequest("BATTLESCRIBE_LAYOUT", "No gameSystem in the .gst file");

            for (Element ct : list(gameSystem, "costTypes", "costType")) {
                String n = attr(ct, "name").trim().toLowerCase(Locale.ROOT);
                if (n.equals("pts") || n.equals("points")) ptsTypeId = attr(ct, "id");
                if (n.equals("dp") || n.contains("detachment")) dpTypeId = attr(ct, "id");
            }
            if (ptsTypeId.isEmpty()) report.warn("no-points-type", "No 'pts' cost type in the game system, points not read", null, null);

            collectGlossary(gameSystem);
            catalogues.values().forEach(c -> collectGlossary(c.root));
            battleSizes();

            for (Catalogue c : catalogues.values()) {
                if (!c.library) faction(c);
            }
            for (GlossaryEntry g : glossary.values()) {
                GlossaryKind kind = glossaryKinds.getOrDefault(g.key(), GlossaryKind.RULE_TERM);
                out.add(new GlossaryEntry(g.key(), g.term(), g.aliases(), kind, g.text(), g.seeAlso(), List.of()), null);
            }
            return out.build();
        }

        void index(Element root) {
            NodeList all = root.getElementsByTagName("*");
            for (int i = 0; i < all.getLength(); i++) {
                Element e = (Element) all.item(i);
                String id = attr(e, "id");
                if (id.isEmpty()) continue;
                switch (e.getTagName()) {
                    case "selectionEntry", "selectionEntryGroup", "profile", "rule", "infoGroup", "categoryEntry" -> byId.putIfAbsent(id, e);
                    default -> {}
                }
            }
        }

        // ---- glossary and battle sizes ----------------------------------------------------------

        void collectGlossary(Element root) {
            for (Element rule : list(root, "sharedRules", "rule")) {
                if (flag(rule, "hidden")) continue;
                String term = attr(rule, "name").trim();
                if (term.isEmpty()) continue;
                String key = Keys.glossary(term);
                glossaryKeyByRuleId.put(attr(rule, "id"), key);
                if (glossary.containsKey(key)) continue;
                glossary.put(key, new GlossaryEntry(key, term, List.of(), GlossaryKind.RULE_TERM,
                        RulesText.of(TextCleaner.battleScribe(description(rule))), List.of(), List.of()));
                report.count("core", "glossary");
            }
        }

        void battleSizes() {
            List<Element> roots = new ArrayList<>();
            roots.addAll(list(gameSystem, "selectionEntries", "selectionEntry"));
            roots.addAll(list(gameSystem, "sharedSelectionEntries", "selectionEntry"));
            for (Element e : roots) {
                if (!attr(e, "name").toLowerCase(Locale.ROOT).contains("battle size")) continue;
                List<Element> choices = new ArrayList<>(list(e, "selectionEntries", "selectionEntry"));
                for (Element g : list(e, "selectionEntryGroups", "selectionEntryGroup")) choices.addAll(list(g, "selectionEntries", "selectionEntry"));
                for (Element choice : choices) {
                    String raw = attr(choice, "name").trim();
                    String name = raw.replaceAll("\\s*\\(.*\\)\\s*$", "").trim();
                    Matcher m = POINTS_IN_NAME.matcher(raw);
                    Optional<Integer> limit = m.find() ? Optional.of(Integer.parseInt(m.group(1).replaceAll("[,.]", ""))) : Optional.empty();
                    if (limit.isEmpty()) report.warn("battle-size-points", "No points limit found in battle size '" + raw + "'", "core", raw);
                    out.add(new BattleSize(Keys.battleSize(name), name, limit, Optional.empty(), Map.of()), attr(choice, "id"));
                    report.count("core", "battle_size");
                }
            }
        }

        // ---- factions ---------------------------------------------------------------------------

        void faction(Catalogue c) {
            String display = c.name;
            Optional<Allegiance> allegiance = Optional.empty();
            Matcher m = ALLEGIANCE_PREFIX.matcher(c.name);
            if (m.matches()) {
                display = m.group(2).trim();
                allegiance = allegianceOf(m.group(1));
            }
            if (display.toLowerCase(Locale.ROOT).contains("unaligned")) allegiance = Optional.of(Allegiance.UNALIGNED);
            String fKey = Keys.faction(display);

            Optional<String> parent = Optional.empty();
            List<Catalogue> libraries = new ArrayList<>();
            for (Element link : list(c.root, "catalogueLinks", "catalogueLink")) {
                Catalogue target = catalogues.get(attr(link, "targetId"));
                if (target == null) {
                    report.warn("missing-catalogue", c.name + " links to a catalogue that is not in the upload: " + attr(link, "name"), fKey, attr(link, "targetId"));
                    continue;
                }
                if (!flag(link, "importRootEntries")) continue;
                if (target.library) libraries.add(target);
                else if (parent.isEmpty()) parent = Optional.of(Keys.faction(ALLEGIANCE_PREFIX.matcher(target.name).matches()
                        ? ALLEGIANCE_PREFIX.matcher(target.name).replaceAll("$2").trim() : target.name));
            }
            out.add(new Faction(fKey, display, parent, allegiance), c.id);
            report.count(fKey, "faction");

            for (Element rule : list(c.root, "rules", "rule")) {
                if (flag(rule, "hidden")) continue;
                String name = attr(rule, "name").trim();
                String text = TextCleaner.battleScribe(description(rule));
                String key = Keys.child(fKey, "rule", name);
                if (out.add(new ArmyRule(key, fKey, name, RulesText.of(text)), attr(rule, "id"))) {
                    report.count(fKey, "army_rule");
                    out.add(new Ability(Keys.child(key, "ab", name), AbilityOwner.ARMY_RULE, key, Optional.of(fKey), name,
                            RulesText.of(text), PhaseTags.NONE, Optional.empty()), null);
                }
            }

            Map<String, String> detachmentIds = detachments(c, fKey);
            List<Element> roots = rootEntries(c, new HashSet<>());
            for (Catalogue lib : libraries) {
                List<Element> libRoots = rootEntries(lib, new HashSet<>());
                if (!libRoots.isEmpty()) report.info("library", c.name + " imports " + libRoots.size() + " root entries from " + lib.name, fKey, lib.id);
                roots.addAll(libRoots);
            }
            Map<String, String> sheetNames = new LinkedHashMap<>();
            Map<String, List<String>> leaderNames = new LinkedHashMap<>();
            for (Element entry : roots) datasheet(fKey, entry, sheetNames, leaderNames);
            resolveLeaders(fKey, sheetNames, leaderNames);
            enhancements(c, fKey, detachmentIds);
        }

        List<Element> rootEntries(Catalogue c, Set<String> seen) {
            List<Element> roots = new ArrayList<>();
            roots.addAll(list(c.root, "selectionEntries", "selectionEntry"));
            roots.addAll(list(c.root, "entryLinks", "entryLink"));
            return roots;
        }

        Optional<Allegiance> allegianceOf(String prefix) {
            return switch (prefix.toLowerCase(Locale.ROOT)) {
                case "imperium" -> Optional.of(Allegiance.IMPERIUM);
                case "chaos" -> Optional.of(Allegiance.CHAOS);
                case "unaligned" -> Optional.of(Allegiance.UNALIGNED);
                default -> Optional.of(Allegiance.XENOS);
            };
        }

        /** entryLink -> its target; selectionEntry -> itself. */
        Optional<Element> resolve(Element e) {
            if (!e.getTagName().equals("entryLink")) return Optional.of(e);
            return Optional.ofNullable(byId.get(attr(e, "targetId")));
        }

        // ---- datasheets -------------------------------------------------------------------------

        void datasheet(String fKey, Element rootEntry, Map<String, String> sheetNames, Map<String, List<String>> leaderNames) {
            Optional<Element> target = resolve(rootEntry);
            if (target.isEmpty()) {
                report.warn("broken-link", "Root entry '" + attr(rootEntry, "name") + "' points at a missing id", fKey, attr(rootEntry, "targetId"));
                return;
            }
            Element entry = target.get();
            if (!entry.getTagName().equals("selectionEntry")) return;
            String type = attr(entry, "type");
            if (!type.equals("unit") && !type.equals("model")) {
                return; // configuration entries (detachment choice, show/hide...) are read elsewhere
            }
            Element link = rootEntry == entry ? null : rootEntry;
            if (flag(rootEntry, "hidden") || flag(entry, "hidden")) {
                report.info("hidden-entry", "Skipped hidden root entry '" + attr(entry, "name") + "'", fKey, attr(entry, "id"));
                return;
            }
            String rawName = attr(link != null && !attr(link, "name").isBlank() ? link : entry, "name").trim();
            boolean legends = rawName.toLowerCase(Locale.ROOT).contains("[legends]");
            String name = rawName.replaceAll("(?i)\\s*\\[legends]\\s*", " ").trim();
            String key = Keys.datasheet(fKey, name);

            // Categories: role (primary), keywords and faction keywords.
            List<String> keywords = new ArrayList<>();
            List<String> factionKeywords = new ArrayList<>();
            Optional<String> role = Optional.empty();
            List<Element> cats = new ArrayList<>(list(entry, "categoryLinks", "categoryLink"));
            if (link != null) cats.addAll(list(link, "categoryLinks", "categoryLink"));
            for (Element cl : cats) {
                String cname = attr(cl, "name").trim();
                Element ce = byId.get(attr(cl, "targetId"));
                if (ce != null && !attr(ce, "name").isBlank()) cname = attr(ce, "name").trim();
                if (cname.isEmpty()) continue;
                if (cname.equalsIgnoreCase("legends")) {
                    legends = true;
                    continue;
                }
                if (cname.toLowerCase(Locale.ROOT).startsWith("faction:")) {
                    addUnique(factionKeywords, cname.substring("faction:".length()).trim());
                    continue;
                }
                addUnique(keywords, cname);
                if (flag(cl, "primary") && role.isEmpty()) role = Optional.of(cname);
            }
            if (role.isEmpty()) report.warn("no-role", "Datasheet '" + name + "' has no primary category", fKey, key);

            UnitScan scan = new UnitScan();
            scanInfo(entry, scan);
            if (link != null) scanInfo(link, scan);
            walkChildren(entry, key, scan, 0);

            Optional<String> invuln = Optional.empty();
            List<String> leaders = new ArrayList<>();
            for (AbilityInfo a : scan.abilities.values()) {
                String lower = a.name().toLowerCase(Locale.ROOT);
                if (lower.contains("invulnerable save")) {
                    Matcher im = INVULN.matcher(a.text() + " " + a.name());
                    if (im.find()) invuln = Optional.of(im.group(1) + "+");
                }
                if (lower.equals("leader")) {
                    Matcher lm = LEADER_BULLET.matcher(a.text());
                    while (lm.find()) leaders.add(lm.group(1).replaceAll("[.;]$", "").replaceAll("\\s*\\*.*$", "").trim());
                }
            }

            List<StatProfile> profiles = new ArrayList<>();
            for (Element p : scan.unitProfiles) {
                Map<String, String> ch = characteristics(p);
                profiles.add(new StatProfile(attr(p, "name").trim(), ch.getOrDefault("m", ""), ch.getOrDefault("t", ""),
                        ch.getOrDefault("sv", ""), invuln, ch.getOrDefault("w", ""), ch.getOrDefault("ld", ""), ch.getOrDefault("oc", "")));
            }
            if (profiles.isEmpty()) report.warn("no-profile", "Datasheet '" + name + "' has no Unit profile", fKey, key);

            Optional<Integer> maxCopies = Optional.empty();
            for (Element el : link == null ? List.of(entry) : List.of(link, entry)) {
                for (Element con : list(el, "constraints", "constraint")) {
                    String scope = attr(con, "scope");
                    if (attr(con, "type").equals("max") && attr(con, "field").equals("selections") && (scope.equals("roster") || scope.equals("force"))) {
                        maxCopies = intAttr(con, "value").filter(v -> v >= 0);
                    }
                }
                if (maxCopies.isPresent()) break;
            }

            Datasheet sheet = new Datasheet(key, fKey, name, role, keywords, factionKeywords, profiles, legends, List.of(),
                    maxCopies, Optional.empty(), Optional.empty());
            if (!out.add(sheet, attr(entry, "id"))) return;
            sheetNames.put(Keys.matchName(name), key);
            if (!leaders.isEmpty()) leaderNames.put(key, leaders);
            report.count(fKey, "datasheet");

            for (Element w : scan.weapons.values()) {
                Map<String, String> ch = characteristics(w);
                boolean melee = attr(w, "typeName").toLowerCase(Locale.ROOT).contains("melee");
                String wname = attr(w, "name").trim().replaceAll("^➤\\s*", "");
                List<KeywordRef> abilities = new ArrayList<>();
                for (String kw : ch.getOrDefault("keywords", "").split(",")) {
                    String k = kw.trim();
                    if (k.isEmpty() || k.equals("-")) continue;
                    abilities.add(KeywordRef.of(k));
                    markWeaponAbility(k);
                }
                out.add(new Weapon(Keys.child(key, "w", wname + (melee ? " melee" : "")), key, wname,
                        melee ? WeaponType.MELEE : WeaponType.RANGED, ch.getOrDefault("range", melee ? "Melee" : ""),
                        ch.getOrDefault("a", ""), ch.getOrDefault(melee ? "ws" : "bs", ch.getOrDefault("ws", ch.getOrDefault("bs", ""))),
                        ch.getOrDefault("s", ""), ch.getOrDefault("ap", ""), ch.getOrDefault("d", ""), abilities), attr(w, "id"));
                report.count(fKey, "weapon");
            }
            for (AbilityInfo a : scan.abilities.values()) {
                out.add(new Ability(Keys.child(key, "ab", a.name()), AbilityOwner.DATASHEET, key, Optional.of(fKey), a.name(),
                        RulesText.of(a.text()), PhaseTags.NONE, a.glossaryKey()), null);
                report.count(fKey, "ability");
            }
            for (WargearOption o : scan.options) {
                out.add(o, null);
                report.count(fKey, "wargear_option");
            }
            unitSizes(fKey, key, entry, link);
        }

        void addUnique(List<String> list, String v) {
            if (list.stream().noneMatch(x -> x.equalsIgnoreCase(v))) list.add(v);
        }

        void markWeaponAbility(String printed) {
            String base = printed.replaceAll("(?i)\\s+(\\d+\\+?|d\\d+(\\+\\d+)?|\\d+\")$", "").trim();
            String g = Keys.glossary(base);
            if (glossary.containsKey(g)) glossaryKinds.put(g, GlossaryKind.WEAPON_ABILITY);
        }

        Map<String, String> characteristics(Element profile) {
            Map<String, String> m = new HashMap<>();
            for (Element c : list(profile, "characteristics", "characteristic")) {
                m.put(attr(c, "name").trim().toLowerCase(Locale.ROOT), text(c).trim());
            }
            return m;
        }

        /** Profiles, rules and info links directly on an entry or link. */
        void scanInfo(Element e, UnitScan scan) {
            for (Element p : list(e, "profiles", "profile")) profile(p, scan);
            for (Element r : list(e, "rules", "rule")) rule(r, scan);
            for (Element g : list(e, "infoGroups", "infoGroup")) scanInfo(g, scan);
            for (Element il : list(e, "infoLinks", "infoLink")) {
                Element t = byId.get(attr(il, "targetId"));
                if (t == null) {
                    report.warn("broken-link", "Info link '" + attr(il, "name") + "' points at a missing id", null, attr(il, "targetId"));
                    continue;
                }
                switch (t.getTagName()) {
                    case "profile" -> profile(t, scan);
                    case "rule" -> rule(t, scan);
                    case "infoGroup" -> scanInfo(t, scan);
                    default -> {}
                }
            }
        }

        void profile(Element p, UnitScan scan) {
            if (flag(p, "hidden")) return;
            String typeName = attr(p, "typeName").toLowerCase(Locale.ROOT);
            String name = attr(p, "name").trim();
            if (typeName.equals("unit")) {
                if (scan.unitProfiles.stream().noneMatch(x -> attr(x, "name").equals(attr(p, "name")))) scan.unitProfiles.add(p);
            } else if (typeName.contains("weapon")) {
                scan.weapons.putIfAbsent(name + "|" + typeName, p);
            } else if (typeName.contains("abilit")) {
                Map<String, String> ch = characteristics(p);
                String text = ch.getOrDefault("description", String.join("\n", ch.values()));
                scan.abilities.putIfAbsent(Keys.slug(name), new AbilityInfo(name, TextCleaner.battleScribe(text), Optional.empty()));
            } else {
                // Other profile types (for example Transport): keep every characteristic as text.
                StringBuilder sb = new StringBuilder();
                for (Element c : list(p, "characteristics", "characteristic")) {
                    if (sb.length() > 0) sb.append('\n');
                    sb.append(attr(c, "name").trim()).append(": ").append(text(c).trim());
                }
                scan.abilities.putIfAbsent(Keys.slug(name), new AbilityInfo(name, TextCleaner.battleScribe(sb.toString()), Optional.empty()));
            }
        }

        void rule(Element r, UnitScan scan) {
            if (flag(r, "hidden")) return;
            String name = attr(r, "name").trim();
            Optional<String> g = Optional.ofNullable(glossaryKeyByRuleId.get(attr(r, "id")));
            g.ifPresent(k -> glossaryKinds.putIfAbsent(k, GlossaryKind.CORE_ABILITY));
            scan.abilities.putIfAbsent(Keys.slug(name), new AbilityInfo(name, TextCleaner.battleScribe(description(r)), g));
        }

        /** Walks child entries for profiles and wargear options. */
        void walkChildren(Element entry, String sheetKey, UnitScan scan, int depth) {
            if (depth > MAX_DEPTH || !scan.visited.add(attr(entry, "id") + "@" + depth)) return;
            for (Element child : list(entry, "selectionEntries", "selectionEntry")) {
                childEntry(child, child, sheetKey, scan, depth);
            }
            for (Element link : list(entry, "entryLinks", "entryLink")) {
                resolve(link).ifPresent(t -> {
                    if (t.getTagName().equals("selectionEntryGroup")) group(link, t, sheetKey, scan, depth);
                    else childEntry(link, t, sheetKey, scan, depth);
                });
            }
            for (Element g : list(entry, "selectionEntryGroups", "selectionEntryGroup")) group(g, g, sheetKey, scan, depth);
        }

        void childEntry(Element linkOrEntry, Element entry, String sheetKey, UnitScan scan, int depth) {
            if (flag(linkOrEntry, "hidden") || flag(entry, "hidden")) return;
            scanInfo(entry, scan);
            if (linkOrEntry != entry) scanInfo(linkOrEntry, scan);
            walkChildren(entry, sheetKey, scan, depth + 1);
        }

        void group(Element linkOrGroup, Element group, String sheetKey, UnitScan scan, int depth) {
            if (flag(linkOrGroup, "hidden") || flag(group, "hidden")) return;
            String name = attr(linkOrGroup, "name").isBlank() ? attr(group, "name") : attr(linkOrGroup, "name");
            String lower = name.toLowerCase(Locale.ROOT);
            if (lower.contains("enhancement") || lower.contains("warlord")) return;
            List<String> choices = new ArrayList<>();
            boolean containsModels = false;
            Optional<Integer> pointsDelta = Optional.empty();
            List<Element> members = new ArrayList<>(list(group, "selectionEntries", "selectionEntry"));
            members.addAll(list(group, "entryLinks", "entryLink"));
            for (Element m : members) {
                Optional<Element> t = resolve(m);
                if (t.isEmpty() || flag(m, "hidden")) continue;
                if (attr(t.get(), "type").equals("model")) containsModels = true;
                String cname = attr(m, "name").isBlank() ? attr(t.get(), "name") : attr(m, "name");
                choices.add(cname.trim());
                Optional<Integer> cost = cost(m, ptsTypeId).or(() -> cost(t.get(), ptsTypeId)).filter(c -> c != 0);
                if (pointsDelta.isEmpty()) pointsDelta = cost;
            }
            walkChildren(group, sheetKey, scan, depth + 1);
            for (Element m : members) resolve(m).ifPresent(t -> {
                if (t.getTagName().equals("selectionEntry")) childEntry(m, t, sheetKey, scan, depth + 1);
            });
            if (containsModels || choices.isEmpty()) return;
            Optional<Integer> min = constraint(linkOrGroup, group, "min");
            Optional<Integer> max = constraint(linkOrGroup, group, "max");
            Optional<Integer> perModels = perModels(linkOrGroup, group);
            String description = "Choose " + max.map(m -> "up to " + m + (perModels.isPresent() ? " per " + perModels.get() + " models" : ""))
                    .orElse("any") + ": " + String.join(", ", choices);
            scan.options.add(new WargearOption(Keys.child(sheetKey, "opt", name), sheetKey, name.trim(), description, choices,
                    min, max, perModels, pointsDelta));
        }

        Optional<Integer> constraint(Element a, Element b, String type) {
            for (Element el : a == b ? List.of(a) : List.of(a, b)) {
                for (Element c : list(el, "constraints", "constraint")) {
                    if (attr(c, "type").equals(type) && attr(c, "field").equals("selections") && attr(c, "scope").equals("parent")) {
                        return intAttr(c, "value");
                    }
                }
            }
            return Optional.empty();
        }

        /** "increment max by 1 for every N models" modifiers on the group's max constraint. */
        Optional<Integer> perModels(Element a, Element b) {
            Set<String> maxIds = new HashSet<>();
            for (Element el : a == b ? List.of(a) : List.of(a, b)) {
                for (Element c : list(el, "constraints", "constraint")) if (attr(c, "type").equals("max")) maxIds.add(attr(c, "id"));
            }
            for (Element el : a == b ? List.of(a) : List.of(a, b)) {
                for (Element mod : list(el, "modifiers", "modifier")) {
                    if (!attr(mod, "type").equals("increment") || !maxIds.contains(attr(mod, "field"))) continue;
                    for (Element rep : list(mod, "repeats", "repeat")) {
                        Optional<Integer> v = intAttr(rep, "value");
                        if (v.isPresent() && v.get() > 0) return v;
                    }
                }
            }
            return Optional.empty();
        }

        Optional<Integer> cost(Element e, String typeId) {
            if (typeId.isEmpty()) return Optional.empty();
            for (Element c : list(e, "costs", "cost")) {
                if (attr(c, "typeId").equals(typeId)) return intAttr(c, "value");
            }
            return Optional.empty();
        }

        // ---- unit sizes -------------------------------------------------------------------------

        void unitSizes(String fKey, String key, Element entry, Element link) {
            int min;
            if (attr(entry, "type").equals("model")) {
                min = 1;
            } else {
                min = 0;
                for (Element child : list(entry, "selectionEntries", "selectionEntry")) {
                    if (attr(child, "type").equals("model")) min += constraint(child, child, "min").orElse(0);
                }
                for (Element l : list(entry, "entryLinks", "entryLink")) {
                    Optional<Element> t = resolve(l);
                    if (t.isPresent() && attr(t.get(), "type").equals("model")) min += constraint(l, t.get(), "min").orElse(0);
                }
                for (Element g : list(entry, "selectionEntryGroups", "selectionEntryGroup")) {
                    boolean models = list(g, "selectionEntries", "selectionEntry").stream().anyMatch(x -> attr(x, "type").equals("model"))
                            || list(g, "entryLinks", "entryLink").stream().map(this::resolve).flatMap(Optional::stream)
                                    .anyMatch(x -> attr(x, "type").equals("model"));
                    if (!models) continue;
                    Optional<Integer> gmin = constraint(g, g, "min");
                    if (gmin.isPresent()) min += gmin.get();
                    else {
                        for (Element x : list(g, "selectionEntries", "selectionEntry")) min += constraint(x, x, "min").orElse(0);
                    }
                }
                if (min == 0) min = 1;
            }
            Optional<Integer> base = (link == null ? Optional.<Integer>empty() : cost(link, ptsTypeId).filter(v -> v > 0))
                    .or(() -> cost(entry, ptsTypeId));
            TreeMap<Integer, Optional<Integer>> sizes = new TreeMap<>();
            sizes.put(min, base);
            boolean increments = false;
            for (Element el : link == null ? List.of(entry) : List.of(entry, link)) {
                for (Element mod : list(el, "modifiers", "modifier")) {
                    if (!attr(mod, "field").equals(ptsTypeId) || ptsTypeId.isEmpty()) continue;
                    if (!attr(mod, "type").equals("set")) {
                        increments = true;
                        continue;
                    }
                    Optional<Integer> models = modelCondition(mod);
                    Optional<Integer> value = intAttr(mod, "value");
                    if (models.isPresent() && value.isPresent()) sizes.put(models.get(), value);
                }
            }
            if (increments) report.warn("points-increment", "Points for '" + key + "' use increment modifiers, only fixed sizes were read", fKey, key);
            sizes.forEach((models, pts) -> {
                out.add(new UnitSizeOption(Keys.unitSize(key, models), key, models + (models == 1 ? " model" : " models"), models, pts), null);
                report.count(fKey, "unit_size");
            });
        }

        Optional<Integer> modelCondition(Element modifier) {
            List<Element> conds = new ArrayList<>(list(modifier, "conditions", "condition"));
            for (Element cg : list(modifier, "conditionGroups", "conditionGroup")) conds.addAll(list(cg, "conditions", "condition"));
            for (Element c : conds) {
                if (!attr(c, "field").equals("selections")) continue;
                Optional<Integer> v = intAttr(c, "value");
                if (v.isEmpty()) continue;
                switch (attr(c, "type")) {
                    case "atLeast", "equalTo" -> {
                        return v;
                    }
                    case "greaterThan" -> {
                        return Optional.of(v.get() + 1);
                    }
                    default -> {}
                }
            }
            return Optional.empty();
        }

        // ---- leaders ----------------------------------------------------------------------------

        void resolveLeaders(String fKey, Map<String, String> sheetNames, Map<String, List<String>> leaderNames) {
            leaderNames.forEach((leaderKey, names) -> {
                List<String> keys = new ArrayList<>();
                for (String n : names) {
                    String k = sheetNames.get(Keys.matchName(n));
                    if (k == null) report.warn("leader-target", "Leader " + leaderKey + " lists unknown unit '" + n + "'", fKey, leaderKey);
                    else keys.add(k);
                }
                if (!keys.isEmpty()) {
                    out.patch(app.muster.gamedata.model.EntityType.DATASHEET, leaderKey, "leaderOf",
                            app.muster.gamedata.build.GameJson.MAPPER.valueToTree(keys));
                }
            });
        }


        // ---- detachments and enhancements --------------------------------------------------------

        /** Returns detachment choice entry id -> detachment key. */
        Map<String, String> detachments(Catalogue c, String fKey) {
            Map<String, String> ids = new LinkedHashMap<>();
            List<Element> candidates = new ArrayList<>();
            for (String wrapper : List.of("selectionEntries", "sharedSelectionEntries")) candidates.addAll(list(c.root, wrapper, "selectionEntry"));
            for (String wrapper : List.of("selectionEntryGroups", "sharedSelectionEntryGroups")) candidates.addAll(list(c.root, wrapper, "selectionEntryGroup"));
            for (Element e : candidates) {
                if (!attr(e, "name").trim().toLowerCase(Locale.ROOT).startsWith("detachment")) continue;
                List<Element> choices = new ArrayList<>(list(e, "selectionEntries", "selectionEntry"));
                choices.addAll(list(e, "entryLinks", "entryLink"));
                for (Element g : list(e, "selectionEntryGroups", "selectionEntryGroup")) {
                    choices.addAll(list(g, "selectionEntries", "selectionEntry"));
                    choices.addAll(list(g, "entryLinks", "entryLink"));
                }
                for (Element choiceLink : choices) {
                    Optional<Element> choice = resolve(choiceLink);
                    if (choice.isEmpty() || flag(choiceLink, "hidden")) continue;
                    detachment(fKey, choiceLink, choice.get(), ids);
                }
            }
            return ids;
        }

        void detachment(String fKey, Element link, Element choice, Map<String, String> ids) {
            String name = (attr(link, "name").isBlank() ? attr(choice, "name") : attr(link, "name")).trim();
            String key = Keys.detachment(fKey, name);
            List<Element> rules = new ArrayList<>(list(choice, "rules", "rule"));
            for (Element il : list(choice, "infoLinks", "infoLink")) {
                Element t = byId.get(attr(il, "targetId"));
                if (t != null && t.getTagName().equals("rule")) rules.add(t);
            }
            Optional<String> ruleName = rules.isEmpty() ? Optional.empty() : Optional.of(attr(rules.get(0), "name").trim());
            StringBuilder text = new StringBuilder();
            for (Element r : rules) {
                if (text.length() > 0) text.append("\n\n");
                if (rules.size() > 1) text.append(attr(r, "name").trim()).append('\n');
                text.append(TextCleaner.battleScribe(description(r)));
            }
            Optional<Integer> dp = dpTypeId.isEmpty() ? Optional.empty() : cost(link, dpTypeId).or(() -> cost(choice, dpTypeId));
            if (!out.add(new Detachment(key, fKey, name, dp, List.of(), ruleName, RulesText.of(text.toString()), Optional.empty(), List.of()),
                    attr(choice, "id"))) return;
            ids.put(attr(choice, "id"), key);
            if (!attr(link, "id").isEmpty()) ids.put(attr(link, "id"), key);
            report.count(fKey, "detachment");
            if (dp.isEmpty()) report.info("detachment-dp", "No detachment point cost found for '" + name + "'", fKey, key);
            for (Element r : rules) {
                String rn = attr(r, "name").trim();
                out.add(new Ability(Keys.child(key, "ab", rn), AbilityOwner.DETACHMENT, key, Optional.of(fKey), rn,
                        RulesText.of(TextCleaner.battleScribe(description(r))), PhaseTags.NONE, Optional.empty()), attr(r, "id"));
            }
            // Stratagem profiles, if the data set has them.
            List<Element> profiles = new ArrayList<>(list(choice, "profiles", "profile"));
            for (Element p : profiles) {
                if (!attr(p, "typeName").toLowerCase(Locale.ROOT).contains("stratagem")) continue;
                Map<String, String> ch = characteristics(p);
                String sname = attr(p, "name").trim();
                Optional<Integer> cp = Optional.ofNullable(ch.getOrDefault("cp", ch.get("cost"))).map(v -> v.replaceAll("\\D", "")).filter(v -> !v.isEmpty()).map(Integer::parseInt);
                out.add(new Stratagem(Keys.child(key, "strat", sname), Optional.of(key), Optional.of(fKey), sname, cp,
                        Optional.ofNullable(ch.get("type")), PhaseTags.NONE,
                        RulesText.of(TextCleaner.battleScribe(ch.getOrDefault("when", ""))),
                        RulesText.of(TextCleaner.battleScribe(ch.getOrDefault("target", ""))),
                        RulesText.of(TextCleaner.battleScribe(ch.getOrDefault("effect", ""))),
                        RulesText.of(TextCleaner.battleScribe(ch.getOrDefault("restrictions", ""))),
                        RulesText.EMPTY), attr(p, "id"));
                report.count(fKey, "stratagem");
            }
            // Enhancement groups inside the detachment choice.
            for (Element g : list(choice, "selectionEntryGroups", "selectionEntryGroup")) {
                if (!attr(g, "name").toLowerCase(Locale.ROOT).contains("enhancement")) continue;
                enhancementGroup(fKey, g, Optional.of(key), ids);
            }
        }

        void enhancements(Catalogue c, String fKey, Map<String, String> detachmentIds) {
            List<Element> groups = new ArrayList<>();
            for (String wrapper : List.of("selectionEntryGroups", "sharedSelectionEntryGroups")) groups.addAll(list(c.root, wrapper, "selectionEntryGroup"));
            for (String wrapper : List.of("selectionEntries", "sharedSelectionEntries")) {
                for (Element e : list(c.root, wrapper, "selectionEntry")) groups.addAll(list(e, "selectionEntryGroups", "selectionEntryGroup"));
            }
            for (Element g : groups) {
                if (!attr(g, "name").toLowerCase(Locale.ROOT).contains("enhancement")) continue;
                enhancementGroup(fKey, g, Optional.empty(), detachmentIds);
            }
        }

        void enhancementGroup(String fKey, Element group, Optional<String> detachmentKey, Map<String, String> detachmentIds) {
            List<Element> members = new ArrayList<>(list(group, "selectionEntries", "selectionEntry"));
            members.addAll(list(group, "entryLinks", "entryLink"));
            for (Element g : list(group, "selectionEntryGroups", "selectionEntryGroup")) {
                Optional<String> nested = detachmentKey.or(() -> detachmentFromConditions(g, detachmentIds));
                enhancementGroup(fKey, g, nested, detachmentIds);
            }
            for (Element m : members) {
                Optional<Element> t = resolve(m);
                if (t.isEmpty()) continue;
                Element e = t.get();
                String name = (attr(m, "name").isBlank() ? attr(e, "name") : attr(m, "name")).trim();
                Optional<String> det = detachmentKey.or(() -> detachmentFromConditions(m, detachmentIds))
                        .or(() -> detachmentFromConditions(e, detachmentIds))
                        .or(() -> detachmentFromConditions(group, detachmentIds));
                if (det.isEmpty()) {
                    report.warn("enhancement-detachment", "Enhancement '" + name + "' could not be tied to a detachment", fKey, attr(e, "id"));
                    continue;
                }
                UnitScan scan = new UnitScan();
                scanInfo(e, scan);
                if (m != e) scanInfo(m, scan);
                StringBuilder text = new StringBuilder();
                for (AbilityInfo a : scan.abilities.values()) {
                    if (text.length() > 0) text.append("\n\n");
                    text.append(a.text());
                }
                List<String> required = new ArrayList<>();
                List<String> forbidden = new ArrayList<>();
                keywordConditions(m, required, forbidden);
                if (m != e) keywordConditions(e, required, forbidden);
                Optional<Integer> pts = cost(m, ptsTypeId).or(() -> cost(e, ptsTypeId));
                String key = Keys.child(det.get(), "enh", name);
                if (out.add(new Enhancement(key, det.get(), fKey, name, pts, required, forbidden, RulesText.of(text.toString()), PhaseTags.NONE), attr(e, "id"))) {
                    report.count(fKey, "enhancement");
                }
            }
        }

        Optional<String> detachmentFromConditions(Element e, Map<String, String> detachmentIds) {
            NodeList conds = e.getElementsByTagName("condition");
            for (int i = 0; i < conds.getLength(); i++) {
                String child = attr((Element) conds.item(i), "childId");
                if (detachmentIds.containsKey(child)) return Optional.of(detachmentIds.get(child));
            }
            return Optional.empty();
        }

        /** Hidden-unless-keyword modifiers: notInstanceOf a category = required, instanceOf = forbidden. */
        void keywordConditions(Element e, List<String> required, List<String> forbidden) {
            for (Element mod : list(e, "modifiers", "modifier")) {
                if (!attr(mod, "field").equals("hidden") || !attr(mod, "value").equals("true")) continue;
                List<Element> conds = new ArrayList<>(list(mod, "conditions", "condition"));
                for (Element cg : list(mod, "conditionGroups", "conditionGroup")) conds.addAll(list(cg, "conditions", "condition"));
                for (Element c : conds) {
                    Element cat = byId.get(attr(c, "childId"));
                    if (cat == null || !cat.getTagName().equals("categoryEntry")) continue;
                    String n = attr(cat, "name").replaceFirst("(?i)^faction:\\s*", "").trim();
                    if (attr(c, "type").equals("notInstanceOf")) addUnique(required, n);
                    else if (attr(c, "type").equals("instanceOf")) addUnique(forbidden, n);
                }
            }
        }
    }
}
