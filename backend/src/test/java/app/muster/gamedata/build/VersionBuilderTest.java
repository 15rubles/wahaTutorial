package app.muster.gamedata.build;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.AbilityOwner;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.gamedata.model.Phase;
import app.muster.gamedata.model.PhaseTags;
import app.muster.gamedata.model.RulesText;
import app.muster.gamedata.model.Source;
import app.muster.gamedata.model.Timing;
import app.muster.gamedata.model.Token;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class VersionBuilderTest {

    static final String F = "rust-pilgrims";
    static final String SHEET = F + ":pilgrim-warband";

    static Datasheet sheet(Optional<String> role, List<String> keywords) {
        return new Datasheet(SHEET, F, "Pilgrim Warband", role, keywords, List.of("Rust Pilgrims"), List.of(), false, List.of(),
                Optional.empty(), Optional.empty(), Optional.empty());
    }

    static UnitSizeOption size(int models, Integer points) {
        return new UnitSizeOption(Keys.unitSize(SHEET, models), SHEET, models + " models", models, Optional.ofNullable(points));
    }

    static ImportReport.Collector collector() {
        return new ImportReport.Collector();
    }

    static SourceSet battleScribe() {
        SourceSet.Builder b = new SourceSet.Builder(Source.BATTLESCRIBE, collector());
        b.add(sheet(Optional.of("Infantry"), List.of("Infantry", "Battleline")), "bs-1");
        b.add(size(10, 90), null);
        b.add(size(20, 180), null);
        b.add(new WargearOption(SHEET + ":opt:heavy", SHEET, "Heavy", "from bs", List.of("Rust Cannon"), Optional.of(0), Optional.of(1),
                Optional.of(10), Optional.empty()), null);
        b.add(new Ability(SHEET + ":ab:volley", AbilityOwner.DATASHEET, SHEET, Optional.of(F), "Volley",
                RulesText.of("In your Shooting phase, pick one Infantry unit."), PhaseTags.NONE, Optional.empty()), null);
        b.add(new Ability(SHEET + ":ab:hymn", AbilityOwner.DATASHEET, SHEET, Optional.of(F), "Hymn",
                RulesText.of("A calm hymn."), PhaseTags.NONE, Optional.empty()), null);
        b.add(new GlossaryEntry("g:shock-strike", "Shock Strike", List.of(), GlossaryKind.CORE_ABILITY,
                RulesText.of("Arrives from reserve."), List.of(), List.of()), null);
        return b.build();
    }

    static SourceSet wahapedia() {
        SourceSet.Builder b = new SourceSet.Builder(Source.WAHAPEDIA, collector());
        b.add(sheet(Optional.of("Battleline"), List.of()), "w-77");
        b.add(size(5, 50), null);
        b.add(new WargearOption(SHEET + ":opt:heavy", SHEET, "Heavy", "from waha", List.of("Rust Cannon", "Lance"), Optional.empty(),
                Optional.of(2), Optional.empty(), Optional.empty()), null);
        return b.build();
    }

    static SourceSet mfm() {
        SourceSet.Builder b = new SourceSet.Builder(Source.MFM, collector());
        b.addPartial(EntityType.UNIT_SIZE, Keys.unitSize(SHEET, 10), node(Map.of("datasheet", SHEET, "name", "10 models", "models", 10, "points", 95)), null);
        b.addPartial(EntityType.UNIT_SIZE, Keys.unitSize(SHEET, 20), node(Map.of("datasheet", SHEET, "name", "20 models", "models", 20, "points", 185)), null);
        b.addPartial(EntityType.UNIT_SIZE, Keys.unitSize(F + ":ghost", 1), node(Map.of("datasheet", F + ":ghost", "name", "Ghost", "models", 1, "points", 10)), null);
        return b.build();
    }

    static ObjectNode node(Map<String, Object> fields) {
        return GameJson.MAPPER.valueToTree(fields);
    }

    static VersionBuilder.Result build(List<Override> overrides, Optional<VersionBuilder.PreviousVersion> prev, SourceSet... sets) {
        Map<Source, SourceSet> map = new EnumMap<>(Source.class);
        Map<Source, Long> ids = new EnumMap<>(Source.class);
        long id = 1;
        for (SourceSet s : sets) {
            map.put(s.source(), s);
            ids.put(s.source(), id++);
        }
        return VersionBuilder.build(new VersionBuilder.Input(map, ids, overrides, prev));
    }

    static <T extends GameEntity> T find(VersionBuilder.Result r, Class<T> type, String key) {
        return r.entities().stream().map(BuiltEntity::entity).filter(type::isInstance).map(type::cast)
                .filter(e -> e.key().equals(key)).findFirst().orElseThrow(() -> new AssertionError("missing " + key));
    }

    static BuiltEntity built(VersionBuilder.Result r, EntityType type, String key) {
        return r.entities().stream().filter(b -> b.type() == type && b.key().equals(key)).findFirst().orElseThrow();
    }

    @Test
    void textFieldsPreferWahapediaAndKeepProvenance() {
        var r = build(List.of(), Optional.empty(), battleScribe(), wahapedia(), mfm());
        Datasheet d = find(r, Datasheet.class, SHEET);
        assertThat(d.role()).contains("Battleline");
        // Wahapedia had no keywords, so BattleScribe's list is used.
        assertThat(d.keywords()).containsExactly("Infantry", "Battleline");
        BuiltEntity b = built(r, EntityType.DATASHEET, SHEET);
        assertThat(b.provenance()).containsEntry("role", Source.WAHAPEDIA).containsEntry("keywords", Source.BATTLESCRIBE);
        assertThat(b.externalIds()).containsEntry(Source.BATTLESCRIBE, "bs-1").containsEntry(Source.WAHAPEDIA, "w-77");
        assertThat(b.source()).isEqualTo(Source.WAHAPEDIA);
    }

    @Test
    void pointsPreferMfmAndUnitSizesFollowTheBestPointsSource() {
        var r = build(List.of(), Optional.empty(), battleScribe(), wahapedia(), mfm());
        assertThat(find(r, UnitSizeOption.class, Keys.unitSize(SHEET, 10)).points()).contains(95);
        assertThat(find(r, UnitSizeOption.class, Keys.unitSize(SHEET, 20)).points()).contains(185);
        assertThat(built(r, EntityType.UNIT_SIZE, Keys.unitSize(SHEET, 10)).provenance()).containsEntry("points", Source.MFM);
        // The 5 model size only Wahapedia lists is not in the MFM, so it is dropped and reported.
        assertThat(r.entities()).noneMatch(b -> b.key().equals(Keys.unitSize(SHEET, 5)));
        assertThat(r.report().issues()).anyMatch(i -> i.category().equals("unit-size-dropped"));
    }

    @Test
    void unmatchedMfmRowsAreReportedNotDropped() {
        var r = build(List.of(), Optional.empty(), battleScribe(), mfm());
        assertThat(r.report().issues()).anyMatch(i -> i.category().equals("unmatched") && i.message().contains("ghost"));
        assertThat(r.entities()).noneMatch(b -> b.key().contains("ghost"));
    }

    @Test
    void wargearPrefersBattleScribe() {
        var r = build(List.of(), Optional.empty(), battleScribe(), wahapedia());
        WargearOption o = find(r, WargearOption.class, SHEET + ":opt:heavy");
        assertThat(o.description()).isEqualTo("from bs");
        assertThat(o.perModels()).contains(10);
    }

    @Test
    void overridesWinAndCanCreateEntities() {
        List<Override> overrides = List.of(
                new Override(1, EntityType.UNIT_SIZE, Keys.unitSize(SHEET, 10), "points", GameJson.MAPPER.valueToTree(100), "fix"),
                new Override(2, EntityType.BATTLE_SIZE, "battle-size:skirmish", "*",
                        GameJson.toNode(new BattleSize("battle-size:skirmish", "Skirmish", Optional.of(500), Optional.of(1), Map.of("maxCopiesPerDatasheet", 2))), ""),
                new Override(3, EntityType.DATASHEET, F + ":nobody", "role", GameJson.MAPPER.valueToTree("X"), ""),
                new Override(4, EntityType.ABILITY, SHEET + ":ab:hymn", "tags",
                        GameJson.MAPPER.valueToTree(new PhaseTags(List.of(Phase.COMMAND), Timing.YOUR_TURN, false, true)), ""),
                new Override(5, EntityType.ABILITY, SHEET + ":ab:volley", "text.plain", GameJson.MAPPER.valueToTree("In the Fight phase, Shock Strike."), ""));
        var r = build(overrides, Optional.empty(), battleScribe(), mfm());
        assertThat(find(r, UnitSizeOption.class, Keys.unitSize(SHEET, 10)).points()).contains(100);
        assertThat(built(r, EntityType.UNIT_SIZE, Keys.unitSize(SHEET, 10)).provenance()).containsEntry("points", Source.MANUAL);
        BattleSize bs = find(r, BattleSize.class, "battle-size:skirmish");
        assertThat(bs.pointsLimit()).contains(500);
        assertThat(bs.limit("maxCopiesPerDatasheet")).contains(2);
        assertThat(r.report().issues()).anyMatch(i -> i.category().equals("override-target-missing"));
        Ability hymn = find(r, Ability.class, SHEET + ":ab:hymn");
        assertThat(hymn.tags().confirmed()).isTrue();
        assertThat(hymn.tags().phases()).containsExactly(Phase.COMMAND);
        Ability volley = find(r, Ability.class, SHEET + ":ab:volley");
        assertThat(volley.tags().phases()).containsExactly(Phase.FIGHT);
        assertThat(volley.text().tokens()).contains(new Token.Ref("g:shock-strike", "Shock Strike"));
        assertThat(r.report().overridesApplied()).isEqualTo(4);
    }

    @Test
    void phaseTagsAreInferredAndCounted() {
        var r = build(List.of(), Optional.empty(), battleScribe());
        Ability volley = find(r, Ability.class, SHEET + ":ab:volley");
        assertThat(volley.tags().phases()).containsExactly(Phase.SHOOTING);
        assertThat(volley.tags().timing()).isEqualTo(Timing.YOUR_TURN);
        assertThat(volley.tags().inferred()).isTrue();
        // Volley (inferred) and Hymn (nothing found) both need review.
        assertThat(r.report().phaseTagsToReview()).isEqualTo(2);
    }

    @Test
    void plainKeywordsGetGlossaryEntriesWithReverseIndex() {
        var r = build(List.of(), Optional.empty(), battleScribe());
        GlossaryEntry infantry = find(r, GlossaryEntry.class, "g:infantry");
        assertThat(infantry.kind()).isEqualTo(GlossaryKind.UNIT_KEYWORD);
        assertThat(infantry.text().isBlank()).isTrue();
        assertThat(infantry.referencedBy()).extracting(GlossaryEntry.Reference::key).contains(SHEET + ":ab:volley");
        GlossaryEntry faction = find(r, GlossaryEntry.class, "g:rust-pilgrims");
        assertThat(faction.kind()).isEqualTo(GlossaryKind.FACTION_KEYWORD);
        Ability volley = find(r, Ability.class, SHEET + ":ab:volley");
        assertThat(volley.text().tokens()).contains(new Token.Ref("g:infantry", "Infantry"));
    }

    @Test
    void diffAgainstPreviousVersion() {
        var first = build(List.of(), Optional.empty(), battleScribe());
        Map<String, GameEntity> prev = new HashMap<>();
        first.entities().forEach(b -> prev.put(b.type() + "|" + b.key(), b.entity()));
        prev.put("DATASHEET|" + F + ":old-unit", new Datasheet(F + ":old-unit", F, "Old Unit", Optional.empty(), List.of(), List.of(),
                List.of(), false, List.of(), Optional.empty(), Optional.empty(), Optional.empty()));

        var second = build(List.of(), Optional.of(new VersionBuilder.PreviousVersion(7, prev)), battleScribe(), mfm());
        VersionReport.Diff d = second.report().diff();
        assertThat(d.comparedToVersion()).contains(7L);
        assertThat(d.removed()).extracting(VersionReport.Change::key).containsExactly(F + ":old-unit");
        assertThat(d.points()).anySatisfy(p -> {
            assertThat(p.key()).isEqualTo(Keys.unitSize(SHEET, 10));
            assertThat(p.before()).contains(90);
            assertThat(p.after()).contains(95);
        });
    }

    @Test
    void invalidEntitiesAreReportedAndDropped() {
        SourceSet.Builder b = new SourceSet.Builder(Source.BATTLESCRIBE, collector());
        b.addPartial(EntityType.DATASHEET, F + ":broken", node(Map.of("faction", F)), null);
        var r = build(List.of(), Optional.empty(), b.build());
        assertThat(r.entities()).noneMatch(x -> x.key().equals(F + ":broken"));
        assertThat(r.report().issues()).anyMatch(i -> i.category().equals("invalid"));
    }

    @Test
    void orphansAreDropped() {
        SourceSet.Builder b = new SourceSet.Builder(Source.BATTLESCRIBE, collector());
        b.add(new UnitSizeOption(F + ":gone:size:1", F + ":gone", "1 model", 1, Optional.of(10)), null);
        var r = build(List.of(), Optional.empty(), b.build());
        assertThat(r.entities()).isEmpty();
        assertThat(r.report().issues()).anyMatch(i -> i.category().equals("orphan"));
    }

    @Test
    void sameUnitUnderParentAndChapterIsAlignedToTheChapterKey() {
        SourceSet.Builder bs = new SourceSet.Builder(Source.BATTLESCRIBE, collector());
        bs.add(new app.muster.gamedata.model.Faction(F, "Rust Pilgrims", Optional.empty(), Optional.empty()), null);
        bs.add(new app.muster.gamedata.model.Faction("ember-wardens", "Ember Wardens", Optional.of(F), Optional.empty()), null);
        bs.add(new Datasheet("ember-wardens:ember-keeper", "ember-wardens", "Ember Keeper", Optional.of("Character"), List.of(), List.of(), List.of(),
                false, List.of(), Optional.empty(), Optional.empty(), Optional.empty()), null);
        SourceSet.Builder wa = new SourceSet.Builder(Source.WAHAPEDIA, collector());
        wa.add(new Datasheet(F + ":ember-keeper", F, "Ember Keeper", Optional.of("Infantry Character"), List.of(), List.of(), List.of(),
                false, List.of(), Optional.empty(), Optional.empty(), Optional.empty()), null);
        wa.add(new UnitSizeOption(F + ":ember-keeper:size:1", F + ":ember-keeper", "1 model", 1, Optional.of(85)), null);
        SourceSet.Builder mfm = new SourceSet.Builder(Source.MFM, collector());
        mfm.addPartial(EntityType.UNIT_SIZE, F + ":ember-keepers:size:1",
                node(Map.of("datasheet", F + ":ember-keepers", "name", "1 model", "models", 1, "points", 90)), null);

        var r = build(List.of(), Optional.empty(), bs.build(), wa.build(), mfm.build());
        Datasheet d = find(r, Datasheet.class, "ember-wardens:ember-keeper");
        assertThat(d.role()).contains("Infantry Character");
        assertThat(d.faction()).isEqualTo("ember-wardens");
        assertThat(r.entities()).noneMatch(b -> b.key().equals(F + ":ember-keeper"));
        // The MFM row filed under the parent faction (with a plural name) still lands on the chapter unit.
        assertThat(find(r, UnitSizeOption.class, "ember-wardens:ember-keeper:size:1").points()).contains(90);
        assertThat(r.report().issues()).anyMatch(i -> i.category().equals("key-aligned"));
        assertThat(r.report().issues()).noneMatch(i -> i.category().equals("unmatched"));
    }

    @Test
    void tiersFromAnotherSourceAreDroppedWhenPointsComeFromTheMfm() {
        SourceSet.Builder wa = new SourceSet.Builder(Source.WAHAPEDIA, collector());
        wa.add(sheet(Optional.of("Battleline"), List.of()), null);
        wa.add(new UnitSizeOption(Keys.unitSize(SHEET, 10), SHEET, "10 models", 10, Optional.of(95),
                List.of(new app.muster.gamedata.model.PointsTier(1, Optional.of(2), 95, Optional.empty()),
                        new app.muster.gamedata.model.PointsTier(3, Optional.empty(), 105, Optional.empty()))), null);
        var withMfm = build(List.of(), Optional.empty(), wa.build(), mfm());
        UnitSizeOption u = find(withMfm, UnitSizeOption.class, Keys.unitSize(SHEET, 10));
        assertThat(u.points()).contains(95);
        assertThat(find(withMfm, UnitSizeOption.class, Keys.unitSize(SHEET, 10)).tiers()).isEmpty();
        assertThat(u.pointsFor(3, Optional.empty())).contains(95);
        var wahaOnly = build(List.of(), Optional.empty(), wa.build());
        assertThat(find(wahaOnly, UnitSizeOption.class, Keys.unitSize(SHEET, 10)).pointsFor(3, Optional.empty())).contains(105);
    }
}
