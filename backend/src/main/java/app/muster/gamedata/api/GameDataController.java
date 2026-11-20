package app.muster.gamedata.api;

import app.muster.common.ApiException;
import app.muster.gamedata.api.GameDataDtos.DatasheetDetail;
import app.muster.gamedata.api.GameDataDtos.DatasheetSummary;
import app.muster.gamedata.api.GameDataDtos.DetachmentDetail;
import app.muster.gamedata.api.GameDataDtos.FactionSummary;
import app.muster.gamedata.api.GameDataDtos.GlossaryDetail;
import app.muster.gamedata.api.GameDataDtos.GlossaryHit;
import app.muster.gamedata.api.GameDataDtos.NamedRef;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.ForceDisposition;
import app.muster.gamedata.model.FactionOption;
import app.muster.gamedata.model.ArmyRule;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.service.CoreData;
import app.muster.gamedata.service.FactionData;
import app.muster.gamedata.service.GameDataService;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only game data for signed-in users. {@code version} defaults to the active data version. */
@RestController
@RequestMapping("/api")
@Validated
public class GameDataController {

    private final GameDataService data;

    public GameDataController(GameDataService data) {
        this.data = data;
    }

    private long version(Optional<Long> requested) {
        return requested.orElseGet(data::requireActiveVersion);
    }

    /** Faction key of a datasheet or detachment key ("death-guard:..." -> "death-guard"). */
    static String factionOf(String key) {
        int i = key.indexOf(':');
        if (i <= 0) throw ApiException.badRequest("BAD_KEY", "Not a valid key: " + key);
        return key.substring(0, i);
    }

    @GetMapping("/factions")
    public List<FactionSummary> factions(@RequestParam Optional<Long> version) {
        long v = version(version);
        CoreData core = data.core(v);
        List<FactionSummary> out = new ArrayList<>();
        for (Faction f : core.factions()) {
            int count = data.faction(v, f.key()).datasheets().size();
            out.add(new FactionSummary(f.key(), f.name(), f.parentKey(), f.allegiance(), count));
        }
        return out;
    }

    public record FactionConfig(
            Faction faction, List<ArmyRule> armyRules, List<FactionOption> factionOptions, List<Detachment> detachments) {}

    @GetMapping("/factions/{key}")
    public FactionConfig faction(@PathVariable String key, @RequestParam Optional<Long> version) {
        FactionData f = data.faction(version(version), key);
        return new FactionConfig(f.faction(), f.armyRules(), f.factionOptions(), f.detachments());
    }

    @GetMapping("/factions/{key}/datasheets")
    public List<DatasheetSummary> datasheets(
            @PathVariable String key,
            @RequestParam Optional<String> role,
            @RequestParam Optional<@Size(max = 100) String> q,
            @RequestParam Optional<Long> version) {
        FactionData f = data.faction(version(version), key);
        String needle = q.map(s -> s.trim().toLowerCase(Locale.ROOT)).orElse("");
        return f.datasheets().stream()
                .filter(d -> role.map(r -> d.role().map(r::equalsIgnoreCase).orElse(false)).orElse(true))
                .filter(d -> needle.isEmpty() || d.name().toLowerCase(Locale.ROOT).contains(needle))
                .map(d -> new DatasheetSummary(d.key(), d.name(), d.faction(), d.role(), d.legends(), d.keywords(),
                        d.factionKeywords(), f.sizes(d.key())))
                .toList();
    }

    @GetMapping("/factions/{key}/detachments")
    public List<DetachmentDetail> detachments(@PathVariable String key, @RequestParam Optional<Long> version) {
        FactionData f = data.faction(version(version), key);
        return f.detachments().stream().map(d -> detachmentDetail(f, d)).toList();
    }

    static DetachmentDetail detachmentDetail(FactionData f, Detachment d) {
        return new DetachmentDetail(d, f.abilities(d.key()), f.enhancements(d.key()), f.stratagems(d.key()));
    }

    @GetMapping("/datasheets/{key}")
    public DatasheetDetail datasheet(@PathVariable String key, @RequestParam Optional<Long> version) {
        long v = version(version);
        FactionData f = data.faction(v, factionOf(key));
        Datasheet d = f.datasheet(key).orElseThrow(() -> ApiException.notFound("Datasheet"));
        return datasheetDetail(f, d);
    }

    static DatasheetDetail datasheetDetail(FactionData f, Datasheet d) {
        List<NamedRef> leads = d.leaderOf().stream()
                .map(k -> new NamedRef(k, f.datasheet(k).map(Datasheet::name).orElse(k)))
                .toList();
        List<NamedRef> ledBy = f.datasheets().stream()
                .filter(x -> x.leaderOf().contains(d.key()))
                .map(x -> new NamedRef(x.key(), x.name()))
                .toList();
        return new DatasheetDetail(f.versionId(), d, f.sizes(d.key()), f.weapons(d.key()), f.abilities(d.key()), f.wargear(d.key()), leads, ledBy);
    }

    @GetMapping("/glossary/{key}")
    public GlossaryDetail glossary(@PathVariable String key, @RequestParam Optional<Long> version) {
        CoreData core = data.core(version(version));
        GlossaryEntry g = core.glossary(key).orElseThrow(() -> ApiException.notFound("Glossary entry"));
        List<NamedRef> seeAlso = g.seeAlso().stream()
                .map(k -> new NamedRef(k, core.glossary(k).map(GlossaryEntry::term).orElse(k)))
                .toList();
        return new GlossaryDetail(g, seeAlso);
    }

    @GetMapping("/glossary/search")
    public List<GlossaryHit> searchGlossary(@RequestParam @Size(max = 100) String q, @RequestParam Optional<Long> version) {
        String needle = q.trim().toLowerCase(Locale.ROOT);
        if (needle.isEmpty()) return List.of();
        return data.core(version(version)).glossary().values().stream()
                .filter(g -> g.term().toLowerCase(Locale.ROOT).contains(needle)
                        || g.aliases().stream().anyMatch(a -> a.toLowerCase(Locale.ROOT).contains(needle)))
                .sorted(Comparator.comparing((GlossaryEntry g) -> !g.term().toLowerCase(Locale.ROOT).startsWith(needle))
                        .thenComparing(GlossaryEntry::term))
                .limit(30)
                .map(g -> new GlossaryHit(g.key(), g.term(), g.kind()))
                .toList();
    }

    @GetMapping("/battle-sizes")
    public List<BattleSize> battleSizes(@RequestParam Optional<Long> version) {
        return data.core(version(version)).battleSizes();
    }

    @GetMapping("/force-dispositions")
    public List<ForceDisposition> forceDispositions(@RequestParam Optional<Long> version) {
        return data.core(version(version)).forceDispositions();
    }
}
