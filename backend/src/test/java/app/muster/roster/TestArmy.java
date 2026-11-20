package app.muster.roster;

import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.FactionOption;
import app.muster.gamedata.model.ForceDisposition;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.PointsTier;
import app.muster.gamedata.model.RulesText;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearCost;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.service.CoreData;
import app.muster.gamedata.service.FactionData;
import app.muster.roster.model.RosterEntry;
import app.muster.roster.model.RosterFlags;
import app.muster.roster.model.RosterSnapshot;
import app.muster.roster.model.WargearChoice;
import app.muster.roster.rules.RosterData;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** An invented army ("Rust Pilgrims") for rule tests. Not real game data. */
public final class TestArmy {

    public static final String F = "rust-pilgrims";
    public static final String PROPHET = F + ":rust-prophet";
    public static final String WARBAND = F + ":pilgrim-warband";
    public static final String SAINT = F + ":iron-saint";
    public static final String WALKER = F + ":scrap-walker";
    public static final String CRAWLER = F + ":crawler";
    public static final String CHAPLAIN = F + ":rust-chaplain";
    public static final String MEDIC = F + ":rust-medic";
    public static final String WALL = "unaligned:iron-wall";
    public static final String IRON = F + ":det:iron";
    public static final String EMBER = F + ":det:ember";
    public static final String HEAVY = F + ":det:heavy";
    public static final String RELIC = IRON + ":enh:relic";
    public static final String CROWN = IRON + ":enh:crown";
    public static final String BANNER = IRON + ":enh:banner";
    public static final String EMBER_GIFT = EMBER + ":enh:gift";
    public static final String SKIRMISH = "battle-size:skirmish";
    public static final String CLASH = "battle-size:grand-clash";

    private TestArmy() {}

    static Datasheet sheet(String key, String name, String role, List<String> keywords, List<String> leaderOf, boolean legends, boolean support,
            List<WargearCost> costs) {
        return new Datasheet(key, key.substring(0, key.indexOf(':')), name, Optional.of(role), keywords, List.of("Rust Pilgrims"), List.of(),
                legends, leaderOf, Optional.empty(), Optional.empty(), Optional.empty(), support, costs);
    }

    public static RosterData data() {
        List<GameEntity> core = new ArrayList<>();
        core.add(new Faction(F, "Rust Pilgrims", Optional.empty(), Optional.empty()));
        core.add(new Faction("unaligned", "Unaligned Forces", Optional.empty(), Optional.of(app.muster.gamedata.model.Allegiance.UNALIGNED)));
        core.add(new BattleSize(SKIRMISH, "Skirmish", Optional.of(500), Optional.of(1), Map.of(
                BattleSize.LIMIT_ENHANCEMENTS, 1, BattleSize.LIMIT_MAX_COPIES, 2, BattleSize.LIMIT_MAX_COPIES_BATTLELINE, 4,
                BattleSize.LIMIT_MAX_COPIES_EPIC_HERO, 1, BattleSize.LIMIT_MAX_SAME_UPGRADE, 3, BattleSize.LIMIT_SINGLE_DETACHMENT_DP, 2)));
        core.add(new BattleSize(CLASH, "Grand Clash", Optional.of(2000), Optional.of(3), Map.of(
                BattleSize.LIMIT_ENHANCEMENTS, 4, BattleSize.LIMIT_MAX_COPIES, 3, BattleSize.LIMIT_MAX_COPIES_BATTLELINE, 6,
                BattleSize.LIMIT_MAX_COPIES_EPIC_HERO, 1, BattleSize.LIMIT_MAX_SAME_UPGRADE, 3, BattleSize.LIMIT_MIN_BATTLELINE, 1)));
        core.add(new ForceDisposition("fd:hold", "Hold the Line", RulesText.EMPTY));
        core.add(new ForceDisposition("fd:push", "Push Forward", RulesText.EMPTY));
        CoreData coreData = new CoreData(1, core);

        List<GameEntity> e = new ArrayList<>();
        e.add(sheet(PROPHET, "Rust Prophet", "Infantry Character", List.of("Infantry", "Character"), List.of(WARBAND), false, false, List.of()));
        e.add(sheet(CHAPLAIN, "Rust Chaplain", "Infantry Character", List.of("Infantry", "Character"), List.of(WARBAND), false, false, List.of()));
        e.add(sheet(MEDIC, "Rust Medic", "Infantry", List.of("Infantry"), List.of(WARBAND), false, true, List.of()));
        e.add(sheet(SAINT, "Iron Saint", "Infantry Epic Hero", List.of("Infantry", "Character", "Epic Hero"), List.of(WARBAND), false, false, List.of()));
        e.add(sheet(WARBAND, "Pilgrim Warband", "Battleline", List.of("Infantry", "Battleline"), List.of(), false, false,
                List.of(new WargearCost("Rust Cannon", 5))));
        e.add(sheet(WALKER, "Scrap Walker", "Vehicle", List.of("Vehicle"), List.of(), true, false, List.of()));
        e.add(sheet(CRAWLER, "Crawler", "Vehicle", List.of("Vehicle"), List.of(), false, false, List.of()));
        e.add(new UnitSizeOption(PROPHET + ":size:1", PROPHET, "1 model", 1, Optional.of(70)));
        e.add(new UnitSizeOption(CHAPLAIN + ":size:1", CHAPLAIN, "1 model", 1, Optional.of(60)));
        e.add(new UnitSizeOption(MEDIC + ":size:1", MEDIC, "1 model", 1, Optional.of(30)));
        e.add(new UnitSizeOption(SAINT + ":size:1", SAINT, "1 model", 1, Optional.of(120)));
        e.add(new UnitSizeOption(WARBAND + ":size:10", WARBAND, "10 models", 10, Optional.of(90),
                List.of(new PointsTier(1, Optional.of(2), 90, Optional.empty()), new PointsTier(3, Optional.empty(), 100, Optional.empty()))));
        e.add(new UnitSizeOption(WARBAND + ":size:20", WARBAND, "20 models", 20, Optional.of(180)));
        e.add(new UnitSizeOption(WALKER + ":size:1", WALKER, "1 model", 1, Optional.of(130)));
        e.add(new UnitSizeOption(CRAWLER + ":size:1", CRAWLER, "1 model", 1, Optional.empty()));
        e.add(new WargearOption(WARBAND + ":opt:heavy", WARBAND, "Heavy Weapons", "", List.of("Rust Cannon", "Flame Lance"),
                Optional.empty(), Optional.of(1), Optional.of(10), Optional.empty()));
        e.add(new Detachment(IRON, F, "Pilgrimage of Iron", Optional.of(1), List.of("pilgrimage"), Optional.empty(), RulesText.EMPTY,
                Optional.empty(), List.of("Hold the Line")));
        e.add(new Detachment(EMBER, F, "Ember Host", Optional.of(2), List.of("pilgrimage"), Optional.empty(), RulesText.EMPTY,
                Optional.empty(), List.of("Push Forward")));
        e.add(new Detachment(HEAVY, F, "Heavy Host", Optional.of(2), List.of(), Optional.empty(), RulesText.EMPTY, Optional.empty(), List.of()));
        e.add(new Enhancement(RELIC, IRON, F, "Relic of Rust", Optional.of(20), List.of("Rust Pilgrims"), List.of(), RulesText.EMPTY, PhaseTags.NONE));
        e.add(new Enhancement(CROWN, IRON, F, "Crown of Iron", Optional.of(15), List.of(), List.of(), RulesText.EMPTY, PhaseTags.NONE, false,
                List.of(CHAPLAIN), List.of()));
        e.add(new Enhancement(BANNER, IRON, F, "Banner of Iron", Optional.of(10), List.of(), List.of(), RulesText.EMPTY, PhaseTags.NONE, true,
                List.of(), List.of()));
        e.add(new Enhancement(EMBER_GIFT, EMBER, F, "Ember Gift", Optional.of(25), List.of(), List.of("Infantry"), RulesText.EMPTY, PhaseTags.NONE));
        e.add(new FactionOption(F + ":opt:vow", F, "Vow", List.of(new FactionOption.Value("Vow of Iron", RulesText.EMPTY),
                new FactionOption.Value("Vow of Ash", RulesText.EMPTY))));
        FactionData faction = new FactionData(coreData, coreData.lineage(F), e);

        List<GameEntity> u = new ArrayList<>();
        u.add(new Datasheet(WALL, "unaligned", "Iron Wall", Optional.of("Fortification"), List.of("Fortification"), List.of(), List.of(), false,
                List.of(), Optional.empty(), Optional.empty(), Optional.empty()));
        u.add(new UnitSizeOption(WALL + ":size:1", WALL, "1 model", 1, Optional.of(50)));
        FactionData unaligned = new FactionData(coreData, coreData.lineage("unaligned"), u);
        return new RosterData(faction, List.of(unaligned));
    }

    /** A small legal list in Grand Clash. */
    public static Builder legal() {
        return new Builder()
                .detachments(IRON)
                .forceDisposition("fd:hold")
                .option(F + ":opt:vow", "Vow of Iron")
                .add(PROPHET, "1", e -> e.warlord(true).enhancement(RELIC))
                .add(WARBAND, "10", e -> {});
    }

    public static final class Builder {
        Optional<String> battleSize = Optional.of(CLASH);
        Optional<String> forceDisposition = Optional.empty();
        RosterFlags flags = RosterFlags.DEFAULT;
        final List<String> detachments = new ArrayList<>();
        final java.util.LinkedHashMap<String, String> options = new java.util.LinkedHashMap<>();
        final List<RosterEntry> entries = new ArrayList<>();
        long nextId = 1;

        public Builder battleSize(String key) {
            battleSize = Optional.ofNullable(key);
            return this;
        }

        public Builder forceDisposition(String key) {
            forceDisposition = Optional.ofNullable(key);
            return this;
        }

        public Builder flags(RosterFlags f) {
            flags = f;
            return this;
        }

        public Builder detachments(String... keys) {
            detachments.clear();
            detachments.addAll(List.of(keys));
            return this;
        }

        public Builder option(String key, String value) {
            options.put(key, value);
            return this;
        }

        public Builder add(String sheet, String size, java.util.function.Consumer<EntryBuilder> customize) {
            EntryBuilder b = new EntryBuilder(nextId++, sheet, sheet + ":size:" + size, entries.size());
            customize.accept(b);
            entries.add(b.build());
            return this;
        }

        public long lastId() {
            return nextId - 1;
        }

        public RosterSnapshot build() {
            return new RosterSnapshot(99, "Test", F, battleSize, options, forceDisposition, flags, detachments, entries);
        }
    }

    public static final class EntryBuilder {
        final long id;
        final String sheet;
        final String size;
        final int order;
        boolean warlord;
        Optional<String> enhancement = Optional.empty();
        Optional<Long> attached = Optional.empty();
        final List<WargearChoice> wargear = new ArrayList<>();

        EntryBuilder(long id, String sheet, String size, int order) {
            this.id = id;
            this.sheet = sheet;
            this.size = size;
            this.order = order;
        }

        public EntryBuilder warlord(boolean w) {
            warlord = w;
            return this;
        }

        public EntryBuilder enhancement(String key) {
            enhancement = Optional.of(key);
            return this;
        }

        public EntryBuilder attachedTo(long id) {
            attached = Optional.of(id);
            return this;
        }

        public EntryBuilder wargear(String option, String choice, int count) {
            wargear.add(new WargearChoice(option, choice, count));
            return this;
        }

        RosterEntry build() {
            return new RosterEntry(id, sheet, size, wargear, enhancement, warlord, attached, order);
        }
    }
}
