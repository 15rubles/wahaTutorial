package app.muster.roster;

import app.muster.common.ApiException;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.service.FactionData;
import app.muster.gamedata.service.GameDataService;
import app.muster.roster.RosterDtos.AddEntry;
import app.muster.roster.RosterDtos.ConfigPatch;
import app.muster.roster.RosterDtos.CreateRoster;
import app.muster.roster.RosterDtos.DataUpdatePreview;
import app.muster.roster.RosterDtos.EntryPatch;
import app.muster.roster.RosterDtos.EntryView;
import app.muster.roster.RosterDtos.PointsChange;
import app.muster.roster.RosterDtos.RosterSummary;
import app.muster.roster.RosterDtos.RosterView;
import app.muster.roster.RosterDtos.Totals;
import app.muster.roster.RosterDtos.VersionInfo;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterFlags;
import app.muster.roster.model.RosterSnapshot;
import app.muster.roster.model.WargearChoice;
import app.muster.roster.rules.DetachmentBudgetRule;
import app.muster.roster.rules.RosterData;
import app.muster.roster.rules.RosterPricing;
import app.muster.roster.rules.RosterValidator;
import app.muster.roster.rules.Severity;
import app.muster.roster.rules.Violation;
import java.util.ArrayList;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Roster use cases. Inputs are checked for structural integrity (references must exist in the roster's
 * data version); whether the list is legal is the validation engine's job, reported as violations.
 */
@Service
public class RosterService {

    private final RosterRepository rosters;
    private final GameDataService gameData;
    private final RosterValidator validator;

    public RosterService(RosterRepository rosters, GameDataService gameData, RosterValidator validator) {
        this.rosters = rosters;
        this.gameData = gameData;
        this.validator = validator;
    }

    // ---- queries ----------------------------------------------------------------------------------

    @Transactional
    public List<RosterSummary> list(long ownerId) {
        Optional<Long> active = gameData.activeVersionId();
        return rosters.listForOwner(ownerId).stream()
                .map(r -> new RosterSummary(r.id(), r.name(), r.factionKey(), factionName(r), r.battleSizeKey(), r.pointsTotal(), r.legal(),
                        active.map(a -> a != r.dataVersionId()).orElse(false), r.updatedAt()))
                .toList();
    }

    @Transactional
    public RosterView get(long id, long ownerId) {
        return view(owned(id, ownerId));
    }

    // ---- roster level -----------------------------------------------------------------------------

    @Transactional
    public RosterView create(CreateRoster req, long ownerId) {
        long version = gameData.requireActiveVersion();
        FactionData f = faction(version, req.factionKey());
        Optional<String> size = Optional.ofNullable(blankToNull(req.battleSizeKey()));
        size.ifPresent(k -> f.core().battleSize(k).orElseThrow(() -> ApiException.badRequest("UNKNOWN_BATTLE_SIZE", "Unknown battle size")));
        if (size.isEmpty()) size = f.core().battleSizes().stream().filter(b -> b.pointsLimit().isPresent())
                .reduce((a, b) -> b).map(BattleSize::key); // default: the largest battle size in the data
        long id = rosters.create(ownerId, req.name().trim(), f.faction().key(), version, size);
        return view(owned(id, ownerId));
    }

    @Transactional
    public RosterView updateConfig(long id, long ownerId, ConfigPatch p) {
        RosterRow r = owned(id, ownerId);
        FactionData f = faction(r.dataVersionId(), r.factionKey());
        String name = p.name() == null ? r.name() : p.name().trim();
        Optional<String> size = r.battleSizeKey();
        if (p.battleSizeKey() != null) {
            f.core().battleSize(p.battleSizeKey()).orElseThrow(() -> ApiException.badRequest("UNKNOWN_BATTLE_SIZE", "Unknown battle size"));
            size = Optional.of(p.battleSizeKey());
        }
        Map<String, String> options = new LinkedHashMap<>(r.factionOptions());
        if (p.factionOptions() != null) {
            for (var e : p.factionOptions().entrySet()) {
                var opt = f.factionOption(e.getKey()).orElseThrow(() -> ApiException.badRequest("UNKNOWN_FACTION_OPTION", "Unknown faction option"));
                if (opt.values().stream().noneMatch(v -> v.name().equals(e.getValue()))) {
                    throw ApiException.badRequest("UNKNOWN_FACTION_OPTION", e.getValue() + " is not a choice of " + opt.name());
                }
                options.put(e.getKey(), e.getValue());
            }
        }
        Optional<String> fd = r.forceDisposition();
        if (Boolean.TRUE.equals(p.clearForceDisposition())) fd = Optional.empty();
        if (p.forceDisposition() != null) {
            f.core().forceDisposition(p.forceDisposition()).orElseThrow(() -> ApiException.badRequest("UNKNOWN_FORCE_DISPOSITION", "Unknown force disposition"));
            fd = Optional.of(p.forceDisposition());
        }
        RosterFlags flags = p.flags() == null ? r.flags() : p.flags();
        rosters.updateConfig(new RosterRow(r.id(), r.ownerId(), name, r.factionKey(), r.dataVersionId(), size, options, fd, flags,
                r.pointsTotal(), r.legal(), r.createdAt(), r.updatedAt()));
        return view(owned(id, ownerId));
    }

    @Transactional
    public RosterView setDetachments(long id, long ownerId, List<String> keys) {
        RosterRow r = owned(id, ownerId);
        FactionData f = faction(r.dataVersionId(), r.factionKey());
        List<String> unique = new ArrayList<>(new LinkedHashSet<>(keys));
        for (String k : unique) {
            f.detachment(k).orElseThrow(() -> ApiException.badRequest("UNKNOWN_DETACHMENT", "Detachment " + k + " is not available to this faction"));
        }
        rosters.setDetachments(id, unique);
        rosters.touch(id);
        return view(owned(id, ownerId));
    }

    @Transactional
    public RosterView duplicate(long id, long ownerId, Optional<String> name) {
        RosterRow r = owned(id, ownerId);
        long copy = rosters.duplicate(r, name.map(String::trim).filter(s -> !s.isEmpty()).orElse(trim(r.name() + " (copy)", 100)));
        return view(owned(copy, ownerId));
    }

    @Transactional
    public void delete(long id, long ownerId) {
        if (!rosters.delete(id, ownerId)) throw ApiException.notFound("Roster");
    }

    // ---- entries ----------------------------------------------------------------------------------

    @Transactional
    public RosterView addEntry(long id, long ownerId, AddEntry req) {
        RosterRow r = owned(id, ownerId);
        RosterData data = data(r);
        Datasheet d = data.datasheet(req.datasheetKey())
                .orElseThrow(() -> ApiException.badRequest("UNKNOWN_DATASHEET", "This unit is not available to this army"));
        List<UnitSizeOption> sizes = data.sizes(d.key());
        String size;
        if (req.sizeKey() != null && !req.sizeKey().isBlank()) {
            size = data.size(d.key(), req.sizeKey()).map(UnitSizeOption::key)
                    .orElseThrow(() -> ApiException.badRequest("UNKNOWN_SIZE", "Unknown unit size"));
        } else if (!sizes.isEmpty()) {
            size = sizes.get(0).key();
        } else {
            size = d.key() + ":size:unknown";
        }
        rosters.addEntry(id, d.key(), size);
        rosters.touch(id);
        return view(owned(id, ownerId));
    }

    @Transactional
    public RosterView updateEntry(long id, long ownerId, long entryId, EntryPatch p) {
        RosterRow r = owned(id, ownerId);
        RosterData data = data(r);
        RosterEntry e = rosters.entry(id, entryId).orElseThrow(() -> ApiException.notFound("Unit"));
        String size = e.sizeKey();
        if (p.sizeKey() != null) {
            size = data.size(e.datasheetKey(), p.sizeKey()).map(UnitSizeOption::key)
                    .orElseThrow(() -> ApiException.badRequest("UNKNOWN_SIZE", "Unknown unit size"));
        }
        List<WargearChoice> wargear = e.wargear();
        if (p.wargear() != null) {
            List<WargearOption> options = data.wargear(e.datasheetKey());
            for (WargearChoice w : p.wargear()) {
                WargearOption o = options.stream().filter(x -> x.key().equals(w.option())).findFirst()
                        .orElseThrow(() -> ApiException.badRequest("UNKNOWN_WARGEAR", "Unknown wargear option"));
                if (!o.choices().isEmpty() && o.choices().stream().noneMatch(c -> c.equalsIgnoreCase(w.choice()))) {
                    throw ApiException.badRequest("UNKNOWN_WARGEAR", w.choice() + " is not a choice of " + o.name());
                }
            }
            wargear = p.wargear();
        }
        Optional<String> enhancement = e.enhancementKey();
        if (Boolean.TRUE.equals(p.clearEnhancement())) enhancement = Optional.empty();
        if (p.enhancementKey() != null) {
            Enhancement en = data.enhancement(p.enhancementKey())
                    .orElseThrow(() -> ApiException.badRequest("UNKNOWN_ENHANCEMENT", "Unknown enhancement"));
            enhancement = Optional.of(en.key());
        }
        Optional<Long> attached = e.attachedTo();
        if (Boolean.TRUE.equals(p.detach())) attached = Optional.empty();
        if (p.attachedTo() != null) {
            if (p.attachedTo() == entryId) throw ApiException.badRequest("ATTACH_SELF", "A unit cannot be attached to itself");
            rosters.entry(id, p.attachedTo()).orElseThrow(() -> ApiException.badRequest("UNKNOWN_UNIT", "That unit is not in this list"));
            attached = Optional.of(p.attachedTo());
        }
        boolean warlord = p.warlord() == null ? e.warlord() : p.warlord();
        int sort = p.sortOrder() == null ? e.sortOrder() : p.sortOrder();
        rosters.updateEntry(id, new RosterEntry(e.id(), e.datasheetKey(), size, wargear, enhancement, warlord, attached, sort));
        if (Boolean.TRUE.equals(p.warlord())) rosters.clearWarlords(id, entryId);
        rosters.touch(id);
        return view(owned(id, ownerId));
    }

    @Transactional
    public RosterView deleteEntry(long id, long ownerId, long entryId) {
        owned(id, ownerId);
        rosters.entry(id, entryId).orElseThrow(() -> ApiException.notFound("Unit"));
        rosters.deleteEntry(id, entryId);
        rosters.touch(id);
        return view(owned(id, ownerId));
    }

    // ---- data version update ---------------------------------------------------------------------

    @Transactional
    public DataUpdatePreview previewDataUpdate(long id, long ownerId) {
        RosterRow r = owned(id, ownerId);
        long active = gameData.requireActiveVersion();
        RosterSnapshot snap = snapshot(r);
        RosterData before = data(r);
        RosterData after = dataFor(active, r.factionKey(), r.flags());
        RosterPricing.Result pb = RosterPricing.price(snap, before);
        RosterPricing.Result pa = RosterPricing.price(snap, after);
        List<PointsChange> changes = new ArrayList<>();
        List<String> removed = new ArrayList<>();
        for (RosterEntry e : snap.entries()) {
            String name = before.datasheet(e.datasheetKey()).map(Datasheet::name).orElse(e.datasheetKey());
            if (after.datasheet(e.datasheetKey()).isEmpty()) {
                removed.add(name);
                continue;
            }
            int b = pb.entries().get(e.id()).points();
            int a = pa.entries().get(e.id()).points();
            if (a != b) changes.add(new PointsChange(e.id(), name, b, a));
        }
        return new DataUpdatePreview(r.dataVersionId(), active, pb.total(), pa.total(), changes, removed);
    }

    @Transactional
    public RosterView applyDataUpdate(long id, long ownerId) {
        RosterRow r = owned(id, ownerId);
        long active = gameData.requireActiveVersion();
        if (active == r.dataVersionId()) return view(r);
        RosterData after = dataFor(active, r.factionKey(), r.flags());
        for (RosterEntry e : rosters.entries(id)) {
            if (after.datasheet(e.datasheetKey()).isPresent() && after.size(e.datasheetKey(), e.sizeKey()).isEmpty()) {
                List<UnitSizeOption> sizes = after.sizes(e.datasheetKey());
                if (!sizes.isEmpty()) {
                    rosters.updateEntry(id, new RosterEntry(e.id(), e.datasheetKey(), sizes.get(0).key(), e.wargear(), e.enhancementKey(),
                            e.warlord(), e.attachedTo(), e.sortOrder()));
                }
            }
        }
        rosters.setVersion(id, active);
        return view(owned(id, ownerId));
    }

    // ---- building the view -----------------------------------------------------------------------

    /** Snapshot + data + pricing + validation, as returned by every endpoint. */
    RosterView view(RosterRow r) {
        RosterSnapshot snap = snapshot(r);
        RosterData data = data(r);
        RosterPricing.Result price = RosterPricing.price(snap, data);
        List<Violation> violations = validator.validate(snap, data);
        Optional<BattleSize> size = data.battleSize(snap);
        int errors = (int) violations.stream().filter(v -> v.severity() == Severity.ERROR).count();
        int warnings = (int) violations.stream().filter(v -> v.severity() == Severity.WARNING).count();
        int enhancements = (int) snap.entries().stream().map(RosterEntry::enhancementKey).flatMap(Optional::stream).distinct().count();
        Totals totals = new Totals(price.total(), price.complete(), size.flatMap(BattleSize::pointsLimit),
                DetachmentBudgetRule.total(snap, data), size.flatMap(BattleSize::dpBudget), enhancements,
                size.flatMap(s -> s.limit(BattleSize.LIMIT_ENHANCEMENTS)), errors == 0, errors, warnings);
        List<EntryView> entries = new ArrayList<>();
        for (RosterEntry e : snap.entries()) {
            Optional<Datasheet> d = data.datasheet(e.datasheetKey());
            Optional<UnitSizeOption> s = data.size(e.datasheetKey(), e.sizeKey());
            RosterPricing.EntryPrice p = price.entries().get(e.id());
            entries.add(new EntryView(e.id(), e.datasheetKey(), d.map(Datasheet::name).orElse(e.datasheetKey()), d.flatMap(Datasheet::role),
                    e.sizeKey(), s.map(UnitSizeOption::name), s.map(UnitSizeOption::models).orElse(0), e.wargear(), e.enhancementKey(),
                    e.enhancementKey().flatMap(data::enhancement).map(Enhancement::name), e.warlord(), e.attachedTo(), e.sortOrder(),
                    p.points(), p.complete(), d.isEmpty()));
        }
        rosters.updateTotals(r.id(), price.total(), errors == 0);
        Optional<Long> active = gameData.activeVersionId();
        return new RosterView(r.id(), r.name(), r.factionKey(), data.faction().faction().name(),
                new VersionInfo(r.dataVersionId(), active, active.map(a -> a != r.dataVersionId()).orElse(false)), r.battleSizeKey(),
                r.factionOptions(), r.forceDisposition(), r.flags(), snap.detachments(), entries, totals, violations, r.createdAt(), r.updatedAt());
    }

    RosterSnapshot snapshot(RosterRow r) {
        return new RosterSnapshot(r.id(), r.name(), r.factionKey(), r.battleSizeKey(), r.factionOptions(), r.forceDisposition(), r.flags(),
                rosters.detachments(r.id()), rosters.entries(r.id()));
    }

    RosterData data(RosterRow r) {
        return dataFor(r.dataVersionId(), r.factionKey(), r.flags());
    }

    RosterData dataFor(long version, String factionKey, RosterFlags flags) {
        FactionData f = faction(version, factionKey);
        List<FactionData> extra = flags.unalignedForces() || flags.unalignedFortifications()
                ? gameData.unaligned(version).stream().filter(u -> !u.faction().key().equals(factionKey)).toList()
                : List.of();
        return new RosterData(f, extra);
    }

    private FactionData faction(long version, String factionKey) {
        try {
            return gameData.faction(version, factionKey);
        } catch (ApiException e) {
            throw ApiException.badRequest("UNKNOWN_FACTION", "Faction " + factionKey + " is not in the game data");
        }
    }

    private RosterRow owned(long id, long ownerId) {
        return rosters.findOwned(id, ownerId).orElseThrow(() -> ApiException.notFound("Roster"));
    }

    private String factionName(RosterRow r) {
        try {
            return gameData.core(r.dataVersionId()).faction(r.factionKey()).map(Faction::name).orElse(r.factionKey());
        } catch (RuntimeException e) {
            return r.factionKey();
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String trim(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

}
