package app.muster.realdata;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.build.VersionBuilder;
import app.muster.gamedata.importer.wahapedia.WahapediaImporter;
import app.muster.gamedata.model.Source;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Manual check against real files in ./data-sources (gitignored, never committed). Run with
 * {@code ./mvnw test -Dtest=RealDataSmokeTest -Dmuster.realData=true}. Prints a summary only.
 */
@EnabledIfSystemProperty(named = "muster.realData", matches = "true")
class RealDataSmokeTest {

    static final Path WAHA = Path.of("..", "data-sources", "wahapedia-cache");

    @Test
    void wahapediaExport() throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>();
        try (Stream<Path> s = Files.list(WAHA)) {
            for (Path p : s.toList()) {
                String n = p.getFileName().toString();
                if (n.endsWith(".csv") || n.endsWith(".html")) files.put(n, Files.readAllBytes(p));
            }
        }
        SourceSet set = new WahapediaImporter().parse(files);
        System.out.println("WAHAPEDIA items: " + set.items().size());
        summarize("import", set.report().issues());
        long t0 = System.nanoTime();
        VersionBuilder.Result r = VersionBuilder.build(new VersionBuilder.Input(Map.of(Source.WAHAPEDIA, set), Map.of(Source.WAHAPEDIA, 1L), List.of(), Optional.empty()));
        System.out.println("BUILD ms " + (System.nanoTime() - t0) / 1_000_000);
        System.out.println("BUILT entities: " + r.entities().size() + ", phase tags to review: " + r.report().phaseTagsToReview());
        summarize("build", r.report().issues());
        for (String f : List.of("death-guard", "orks", "imperial-knights", "space-marines", "blood-angels")) {
            System.out.println("COUNTS " + f + " " + r.report().counts().get(f));
        }
        System.out.println("COUNTS core " + r.report().counts().get("core"));
        r.entities().stream().filter(b -> b.key().startsWith("battle-size:")).forEach(b -> System.out.println("BATTLE " + GameJson.write(b.entity())));
        r.entities().stream().filter(b -> b.key().equals("orks:boyz:size:10")).forEach(b -> System.out.println("SAMPLE " + GameJson.write(b.entity())));
        Map<String, Integer> unresolved = new TreeMap<>();
        int total = 0, resolved = 0;
        for (var b : r.entities()) {
            if (b.entity() instanceof app.muster.gamedata.model.Weapon w) {
                for (var k : w.abilities()) {
                    total++;
                    if (k.glossaryId().isPresent()) resolved++;
                    else unresolved.merge(k.label().replaceAll("\\s+[0-9D+\"]+$", ""), 1, Integer::sum);
                }
            }
        }
        System.out.println("WEAPON KEYWORDS resolved " + resolved + "/" + total);
        unresolved.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue().reversed()).limit(25)
                .forEach(e -> System.out.println("UNRESOLVED " + e.getKey() + " " + e.getValue()));
        r.entities().stream().filter(b -> b.key().equals("death-guard:plague-marines:ab:plague-weapons") || b.key().startsWith("g:lethal-hits") || b.key().equals("g:infantry"))
                .forEach(b -> System.out.println("SAMPLE " + GameJson.write(b.entity()).substring(0, Math.min(1500, GameJson.write(b.entity()).length()))));
        assertThat(r.entities()).isNotEmpty();
    }

    static void summarize(String label, List<ImportReport.Issue> issues) {
        Map<String, Long> counts = issues.stream().collect(Collectors.groupingBy(i -> i.level() + " " + i.category(), TreeMap::new, Collectors.counting()));
        counts.forEach((k, v) -> System.out.println("ISSUES " + label + " " + k + ": " + v));
        issues.stream().filter(i -> i.level() != ImportReport.Level.INFO)
                .collect(Collectors.groupingBy(ImportReport.Issue::category))
                .forEach((cat, list) -> list.stream().limit(Integer.getInteger("muster.examples", 4)).forEach(i -> System.out.println("  e.g. " + cat + ": " + i.message())));
        Comparator.naturalOrder();
    }
}
