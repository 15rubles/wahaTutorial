package app.muster.export;

import app.muster.common.ApiException;
import app.muster.gamedata.api.GameDataDtos.DatasheetDetail;
import app.muster.gamedata.api.GameDataDtos.DetachmentDetail;
import app.muster.gamedata.api.GameDataDtos.NamedRef;
import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.GlossaryEntry;

import app.muster.gamedata.service.CoreData;
import app.muster.gamedata.service.FactionData;
import app.muster.gamedata.service.GameDataService;
import app.muster.gamedata.store.DataVersionRepository;
import app.muster.gamedata.store.DataVersionRow;
import app.muster.roster.RosterDtos.EntryView;
import app.muster.roster.RosterDtos.RosterView;
import app.muster.roster.RosterService;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExportService {

    private final RosterService rosters;
    private final GameDataService gameData;
    private final DataVersionRepository versions;

    public ExportService(RosterService rosters, GameDataService gameData, DataVersionRepository versions) {
        this.rosters = rosters;
        this.gameData = gameData;
        this.versions = versions;
    }

    @Transactional
    public ExportData export(long rosterId, long ownerId) {
        RosterView r = rosters.get(rosterId, ownerId);
        long v = r.version().rosterVersion();
        FactionData f = gameData.faction(v, r.factionKey());
        CoreData core = f.core();

        Map<String, DatasheetDetail> sheets = new LinkedHashMap<>();
        for (EntryView e : r.entries()) {
            if (sheets.containsKey(e.datasheetKey())) continue;
            Optional<FactionData> owner = Optional.of(f).filter(x -> x.datasheet(e.datasheetKey()).isPresent())
                    .or(() -> gameData.unaligned(v).stream().filter(u -> u.datasheet(e.datasheetKey()).isPresent()).findFirst());
            owner.ifPresent(o -> o.datasheet(e.datasheetKey()).ifPresent(d -> sheets.put(d.key(), detail(o, d))));
        }

        List<DetachmentDetail> selected = new ArrayList<>();
        List<DetachmentDetail> other = new ArrayList<>();
        for (Detachment d : f.detachments()) {
            DetachmentDetail dd = new DetachmentDetail(d, f.abilities(d.key()), f.enhancements(d.key()), f.stratagems(d.key()));
            (r.detachments().contains(d.key()) ? selected : other).add(dd);
        }
        selected.sort(java.util.Comparator.comparingInt(d -> r.detachments().indexOf(d.detachment().key())));

        // Glossary: every term the candidate content links to, plus one level of terms their texts reference.
        Set<String> ids = new LinkedHashSet<>();
        sheets.values().forEach(s -> collect(GameJson.MAPPER.valueToTree(s), ids));
        f.armyRules().forEach(a -> collect(GameJson.toNode(a), ids));
        selected.forEach(d -> collect(GameJson.MAPPER.valueToTree(d), ids));
        other.forEach(d -> d.stratagems().forEach(s -> collect(GameJson.toNode(s), ids)));
        core.coreStratagems().forEach(s -> collect(GameJson.toNode(s), ids));
        Map<String, GlossaryEntry> glossary = new LinkedHashMap<>();
        for (String id : List.copyOf(ids)) core.glossary(id).ifPresent(g -> glossary.put(id, slim(g)));
        Set<String> second = new LinkedHashSet<>();
        glossary.values().forEach(g -> collect(GameJson.toNode(g), second));
        for (String id : second) core.glossary(id).ifPresent(g -> glossary.putIfAbsent(id, slim(g)));

        DataVersionRow row = versions.find(v).orElseThrow(() -> ApiException.notFound("Data version"));
        return new ExportData(
                r,
                f.faction(),
                r.battleSizeKey().flatMap(core::battleSize),
                r.forceDisposition().flatMap(core::forceDisposition),
                f.factionOptions(),
                f.armyRules(),
                f.armyRules().stream().flatMap(a -> f.abilities(a.key()).stream()).toList(),
                selected,
                other,
                core.coreStratagems(),
                sheets,
                glossary,
                new ExportData.DataVersionInfo(row.id(), row.createdAt(), row.activatedAt()));
    }

    private static DatasheetDetail detail(FactionData f, Datasheet d) {
        List<NamedRef> leads = d.leaderOf().stream().map(k -> new NamedRef(k, f.datasheet(k).map(Datasheet::name).orElse(k))).toList();
        return new DatasheetDetail(f.versionId(), d, f.sizes(d.key()), f.weapons(d.key()), f.abilities(d.key()), f.wargear(d.key()), leads, List.of());
    }

    /** The reverse index is not needed in a PDF and can be large. */
    private static GlossaryEntry slim(GlossaryEntry g) {
        return new GlossaryEntry(g.key(), g.term(), g.aliases(), g.kind(), g.text(), g.seeAlso(), List.of());
    }

    /** Collects glossary ids from tokens, keyword refs and ability links anywhere in a JSON tree. */
    static void collect(JsonNode node, Set<String> out) {
        if (node == null) return;
        if (node.isObject()) {
            if ("ref".equals(node.path("type").asText()) && node.hasNonNull("glossaryId")) out.add(node.get("glossaryId").asText());
            else if (node.has("label") && node.hasNonNull("glossaryId")) out.add(node.get("glossaryId").asText());
            else if (node.has("owner") && node.hasNonNull("glossaryId")) out.add(node.get("glossaryId").asText());
            node.fields().forEachRemaining(e -> {
                if (!e.getKey().equals("referencedBy")) collect(e.getValue(), out);
            });
        } else if (node.isArray()) {
            node.forEach(n -> collect(n, out));
        }
    }

}
