package app.muster.roster;

import static app.muster.roster.TestArmy.*;
import static org.assertj.core.api.Assertions.assertThat;

import app.muster.roster.model.RosterFlags;
import app.muster.roster.model.RosterSnapshot;
import app.muster.roster.rules.BattlelineRule;
import app.muster.roster.rules.DatasheetLimitRule;
import app.muster.roster.rules.DetachmentBudgetRule;
import app.muster.roster.rules.DetachmentUniqueTagRule;
import app.muster.roster.rules.EnhancementRule;
import app.muster.roster.rules.FactionKeywordRule;
import app.muster.roster.rules.FactionOptionRule;
import app.muster.roster.rules.ForceDispositionRule;
import app.muster.roster.rules.LeaderAttachmentRule;
import app.muster.roster.rules.LegendsRule;
import app.muster.roster.rules.PointsLimitRule;
import app.muster.roster.rules.RosterData;
import app.muster.roster.rules.RosterPricing;
import app.muster.roster.rules.RosterRule;
import app.muster.roster.rules.RosterValidator;
import app.muster.roster.rules.Severity;
import app.muster.roster.rules.Violation;
import app.muster.roster.rules.WargearRule;
import app.muster.roster.rules.WarlordRule;
import java.util.List;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class RosterRulesTest {

    static final RosterData DATA = TestArmy.data();

    static List<String> codes(RosterRule rule, RosterSnapshot r) {
        return rule.check(r, DATA).stream().filter(v -> v.severity() != Severity.INFO).map(Violation::code).toList();
    }

    @Test
    void theLegalFixtureIsLegalForEveryRule() {
        List<Violation> all = new RosterValidator().validate(legal().build(), DATA);
        assertThat(all).filteredOn(v -> v.severity() != Severity.INFO).isEmpty();
    }

    @Nested
    class Pricing {
        @Test
        void tiersByCopyWargearAndEnhancements() {
            var r = new TestArmy.Builder()
                    .add(WARBAND, "10", e -> e.wargear(WARBAND + ":opt:heavy", "Rust Cannon", 1))
                    .add(WARBAND, "10", e -> {})
                    .add(WARBAND, "10", e -> {})
                    .add(PROPHET, "1", e -> e.enhancement(RELIC))
                    .build();
            var p = RosterPricing.price(r, DATA);
            assertThat(p.entries().get(1L).points()).isEqualTo(95); // 90 + 5 wargear
            assertThat(p.entries().get(2L).points()).isEqualTo(90);
            assertThat(p.entries().get(3L).points()).isEqualTo(100); // third copy tier
            assertThat(p.entries().get(4L).points()).isEqualTo(90); // 70 + 20 enhancement
            assertThat(p.total()).isEqualTo(375);
            assertThat(p.complete()).isTrue();
        }

        @Test
        void missingPointsAreReportedNotGuessed() {
            var r = new TestArmy.Builder().add(CRAWLER, "1", e -> {}).build();
            var p = RosterPricing.price(r, DATA);
            assertThat(p.complete()).isFalse();
            assertThat(p.entries().get(1L).missing()).isNotEmpty();
            assertThat(codes(new PointsLimitRule(), r)).contains("MISSING_POINTS");
        }
    }

    @Test
    void pointsLimit() {
        assertThat(codes(new PointsLimitRule(), legal().build())).isEmpty();
        var r = legal().battleSize(SKIRMISH).add(WARBAND, "20", e -> {}).add(WARBAND, "20", e -> {}).add(PROPHET, "1", e -> {}).build();
        assertThat(codes(new PointsLimitRule(), r)).containsExactly("POINTS_LIMIT");
        assertThat(codes(new PointsLimitRule(), legal().battleSize(null).build())).containsExactly("NO_BATTLE_SIZE");
        assertThat(codes(new PointsLimitRule(), legal().battleSize("battle-size:nope").build())).containsExactly("UNKNOWN_BATTLE_SIZE");
    }

    @Test
    void detachmentBudget() {
        assertThat(codes(new DetachmentBudgetRule(), legal().build())).isEmpty();
        assertThat(codes(new DetachmentBudgetRule(), legal().detachments().build())).containsExactly("NO_DETACHMENT");
        assertThat(codes(new DetachmentBudgetRule(), legal().detachments(IRON, EMBER, HEAVY).build())).containsExactly("DP_BUDGET");
        assertThat(codes(new DetachmentBudgetRule(), legal().detachments(IRON, IRON).build())).containsExactly("DUPLICATE_DETACHMENT");
        assertThat(codes(new DetachmentBudgetRule(), legal().detachments("x:det:nope").build())).contains("UNKNOWN_DETACHMENT");
        // Skirmish: budget 1 DP, but one detachment of up to 2 DP is allowed on its own.
        assertThat(codes(new DetachmentBudgetRule(), legal().battleSize(SKIRMISH).detachments(EMBER).build())).isEmpty();
        assertThat(codes(new DetachmentBudgetRule(), legal().battleSize(SKIRMISH).detachments(IRON, HEAVY).build())).containsExactly("DP_BUDGET");
    }

    @Test
    void uniqueTags() {
        assertThat(codes(new DetachmentUniqueTagRule(), legal().detachments(IRON, HEAVY).build())).isEmpty();
        assertThat(codes(new DetachmentUniqueTagRule(), legal().detachments(IRON, EMBER).build())).containsExactly("UNIQUE_TAG");
    }

    @Test
    void datasheetLimits() {
        var ok = legal().add(WARBAND, "10", e -> {}).add(WARBAND, "10", e -> {}).add(WARBAND, "10", e -> {}).build();
        assertThat(codes(new DatasheetLimitRule(), ok)).isEmpty(); // battleline: 6 in Grand Clash
        var tooMany = legal().add(CRAWLER, "1", e -> {}).add(CRAWLER, "1", e -> {}).add(CRAWLER, "1", e -> {}).add(CRAWLER, "1", e -> {}).build();
        assertThat(codes(new DatasheetLimitRule(), tooMany)).containsExactly("DATASHEET_LIMIT");
        var heroes = legal().add(SAINT, "1", e -> {}).add(SAINT, "1", e -> {}).build();
        assertThat(codes(new DatasheetLimitRule(), heroes)).containsExactly("DATASHEET_LIMIT");
        assertThat(new DatasheetLimitRule().check(tooMany, DATA).get(0).entryIds()).hasSize(4);
    }

    @Test
    void battlelineMinimumWhenTheDataDefinesOne() {
        assertThat(codes(new BattlelineRule(), legal().build())).isEmpty();
        var none = new TestArmy.Builder().detachments(IRON).add(PROPHET, "1", e -> e.warlord(true)).build();
        assertThat(codes(new BattlelineRule(), none)).containsExactly("BATTLELINE_MINIMUM");
        // Skirmish defines no minimum.
        assertThat(codes(new BattlelineRule(), new TestArmy.Builder().battleSize(SKIRMISH).add(PROPHET, "1", e -> {}).build())).isEmpty();
    }

    @Test
    void warlord() {
        assertThat(codes(new WarlordRule(), legal().build())).isEmpty();
        var none = new TestArmy.Builder().add(PROPHET, "1", e -> {}).build();
        assertThat(codes(new WarlordRule(), none)).containsExactly("NO_WARLORD");
        var two = new TestArmy.Builder().add(PROPHET, "1", e -> e.warlord(true)).add(CHAPLAIN, "1", e -> e.warlord(true)).build();
        assertThat(codes(new WarlordRule(), two)).containsExactly("MULTIPLE_WARLORDS");
        var notChar = new TestArmy.Builder().add(WARBAND, "10", e -> e.warlord(true)).build();
        assertThat(codes(new WarlordRule(), notChar)).containsExactly("WARLORD_NOT_CHARACTER");
        assertThat(codes(new WarlordRule(), new TestArmy.Builder().build())).isEmpty();
    }

    @Test
    void enhancements() {
        assertThat(codes(new EnhancementRule(), legal().build())).isEmpty();
        var wrongDetachment = legal().detachments(EMBER).build();
        assertThat(codes(new EnhancementRule(), wrongDetachment)).containsExactly("ENHANCEMENT_DETACHMENT");
        var notCharacter = legal().add(WARBAND, "10", e -> e.enhancement(CROWN)).build();
        assertThat(codes(new EnhancementRule(), notCharacter)).contains("ENHANCEMENT_NOT_CHARACTER", "ENHANCEMENT_ELIGIBILITY");
        var epic = legal().add(SAINT, "1", e -> e.enhancement(CROWN)).build();
        assertThat(codes(new EnhancementRule(), epic)).contains("ENHANCEMENT_EPIC_HERO");
        var listedOnly = legal().add(PROPHET, "1", e -> e.enhancement(CROWN)).build();
        assertThat(codes(new EnhancementRule(), listedOnly)).containsExactly("ENHANCEMENT_ELIGIBILITY");
        var forbidden = legal().detachments(IRON, EMBER).add(CHAPLAIN, "1", e -> e.enhancement(EMBER_GIFT)).build();
        assertThat(codes(new EnhancementRule(), forbidden)).containsExactly("ENHANCEMENT_ELIGIBILITY");
        var dupe = legal().add(PROPHET, "1", e -> e.enhancement(RELIC)).build();
        assertThat(codes(new EnhancementRule(), dupe)).containsExactly("DUPLICATE_ENHANCEMENT");
        // Upgrades go on non-characters and may repeat up to the data's limit.
        var upgrades = legal().add(WARBAND, "10", e -> e.enhancement(BANNER)).add(WARBAND, "10", e -> e.enhancement(BANNER)).build();
        assertThat(codes(new EnhancementRule(), upgrades)).isEmpty();
        var tooManyUpgrades = legal().add(WARBAND, "10", e -> e.enhancement(BANNER)).add(WARBAND, "10", e -> e.enhancement(BANNER))
                .add(WARBAND, "10", e -> e.enhancement(BANNER)).add(WARBAND, "10", e -> e.enhancement(BANNER)).build();
        assertThat(codes(new EnhancementRule(), tooManyUpgrades)).containsExactly("UPGRADE_LIMIT");
        var overLimit = legal().battleSize(SKIRMISH).add(CHAPLAIN, "1", e -> e.enhancement(CROWN)).build();
        assertThat(codes(new EnhancementRule(), overLimit)).containsExactly("ENHANCEMENT_LIMIT");
        // One per attached unit: a leader with an enhancement joining a unit with an upgrade.
        TestArmy.Builder b = legal();
        long warband = b.lastId();
        var b2 = b.add(CHAPLAIN, "1", e -> e.enhancement(CROWN).attachedTo(warband));
        var attached = b2.build();
        var withUpgrade = new RosterSnapshot(attached.id(), attached.name(), attached.factionKey(), attached.battleSizeKey(),
                attached.factionOptions(), attached.forceDisposition(), attached.flags(), attached.detachments(),
                attached.entries().stream().map(x -> x.id() == warband
                        ? new app.muster.roster.model.RosterEntry(x.id(), x.datasheetKey(), x.sizeKey(), x.wargear(), java.util.Optional.of(BANNER),
                                x.warlord(), x.attachedTo(), x.sortOrder())
                        : x).toList());
        assertThat(codes(new EnhancementRule(), withUpgrade)).containsExactly("ONE_ENHANCEMENT_PER_UNIT");
    }

    @Test
    void leaderAttachment() {
        TestArmy.Builder b = legal();
        long warband = b.lastId();
        assertThat(codes(new LeaderAttachmentRule(), b.add(CHAPLAIN, "1", e -> e.attachedTo(warband)).build())).isEmpty();

        TestArmy.Builder b2 = legal();
        long prophet = 1;
        assertThat(codes(new LeaderAttachmentRule(), b2.add(CHAPLAIN, "1", e -> e.attachedTo(prophet)).build())).containsExactly("ATTACH_NOT_ALLOWED");

        TestArmy.Builder b3 = legal();
        long wb = b3.lastId();
        var twoLeaders = b3.add(CHAPLAIN, "1", e -> e.attachedTo(wb)).add(CHAPLAIN, "1", e -> e.attachedTo(wb)).build();
        assertThat(codes(new LeaderAttachmentRule(), twoLeaders)).containsExactly("TOO_MANY_LEADERS");

        TestArmy.Builder b4 = legal();
        long wb4 = b4.lastId();
        var leaderAndSupport = b4.add(CHAPLAIN, "1", e -> e.attachedTo(wb4)).add(MEDIC, "1", e -> e.attachedTo(wb4)).build();
        assertThat(codes(new LeaderAttachmentRule(), leaderAndSupport)).isEmpty();

        assertThat(codes(new LeaderAttachmentRule(), legal().add(MEDIC, "1", e -> {}).build())).containsExactly("SUPPORT_UNATTACHED");
        assertThat(codes(new LeaderAttachmentRule(), legal().add(CHAPLAIN, "1", e -> e.attachedTo(404)).build())).containsExactly("ATTACH_TARGET_MISSING");
    }

    @Test
    void wargear() {
        assertThat(codes(new WargearRule(), legal().add(WARBAND, "10", e -> e.wargear(WARBAND + ":opt:heavy", "Rust Cannon", 1)).build())).isEmpty();
        // 1 per 10 models: 2 allowed at 20 models, not at 10.
        assertThat(codes(new WargearRule(), legal().add(WARBAND, "20", e -> e.wargear(WARBAND + ":opt:heavy", "Rust Cannon", 2)).build())).isEmpty();
        assertThat(codes(new WargearRule(), legal().add(WARBAND, "10", e -> e.wargear(WARBAND + ":opt:heavy", "Rust Cannon", 2)).build()))
                .containsExactly("WARGEAR_MAX");
        assertThat(codes(new WargearRule(), legal().add(WARBAND, "10", e -> e.wargear(WARBAND + ":opt:heavy", "Laser", 1)).build()))
                .containsExactly("UNKNOWN_WARGEAR");
        assertThat(codes(new WargearRule(), legal().add(WARBAND, "10", e -> e.wargear("nope", "Laser", 1)).build())).containsExactly("UNKNOWN_WARGEAR");
    }

    @Test
    void factionAndUnalignedUnits() {
        assertThat(codes(new FactionKeywordRule(), legal().build())).isEmpty();
        assertThat(codes(new FactionKeywordRule(), legal().add("other:thing", "1", e -> {}).build())).containsExactly("UNKNOWN_DATASHEET");
        var wall = legal().add(WALL, "1", e -> {});
        assertThat(codes(new FactionKeywordRule(), wall.build())).containsExactly("FACTION");
        assertThat(codes(new FactionKeywordRule(), wall.flags(new RosterFlags(false, false, true)).build())).isEmpty();
    }

    @Test
    void legends() {
        var r = legal().add(WALKER, "1", e -> {});
        assertThat(codes(new LegendsRule(), r.build())).containsExactly("LEGENDS");
        assertThat(codes(new LegendsRule(), r.flags(new RosterFlags(true, false, false)).build())).isEmpty();
    }

    @Test
    void forceDisposition() {
        assertThat(codes(new ForceDispositionRule(), legal().build())).isEmpty();
        assertThat(codes(new ForceDispositionRule(), legal().forceDisposition(null).build())).containsExactly("NO_FORCE_DISPOSITION");
        assertThat(codes(new ForceDispositionRule(), legal().forceDisposition("fd:push").build())).containsExactly("FORCE_DISPOSITION");
        assertThat(codes(new ForceDispositionRule(), legal().forceDisposition("fd:nope").build())).containsExactly("UNKNOWN_FORCE_DISPOSITION");
    }

    @Test
    void factionOptions() {
        assertThat(codes(new FactionOptionRule(), legal().build())).isEmpty();
        var missing = new TestArmy.Builder().build();
        assertThat(codes(new FactionOptionRule(), missing)).containsExactly("FACTION_OPTION");
        assertThat(codes(new FactionOptionRule(), legal().option(F + ":opt:vow", "Vow of Nothing").build())).containsExactly("FACTION_OPTION_VALUE");
    }
}
