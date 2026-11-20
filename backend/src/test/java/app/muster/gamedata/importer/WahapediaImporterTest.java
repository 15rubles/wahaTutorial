package app.muster.gamedata.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.muster.common.ApiException;
import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.importer.wahapedia.WahapediaImporter;
import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.ArmyRule;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.ForceDisposition;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.Phase;
import app.muster.gamedata.model.Stratagem;
import app.muster.gamedata.model.Timing;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.model.Weapon;
import app.muster.support.Fixtures;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class WahapediaImporterTest {

    static SourceSet set;

    @BeforeAll
    static void parse() {
        set = new WahapediaImporter().importZip(Fixtures.wahapediaZip());
    }

    @SuppressWarnings("unchecked")
    static <T extends GameEntity> List<T> all(Class<T> type) {
        EntityType et = Arrays.stream(EntityType.values()).filter(t -> t.recordType() == type).findFirst().orElseThrow();
        return set.items().stream().filter(i -> i.type() == et).map(i -> (T) GameJson.fromNode(i.data(), et)).toList();
    }

    static <T extends GameEntity> T get(Class<T> type, String key) {
        return all(type).stream().filter(e -> e.key().equals(key)).findFirst().orElseThrow(() -> new AssertionError("missing " + key));
    }

    @Test
    void factionsAndChapterSubFactions() {
        assertThat(all(Faction.class)).extracting(Faction::key).containsExactlyInAnyOrder("rust-pilgrims", "other-host", "ember-wardens");
        assertThat(get(Faction.class, "ember-wardens").parentKey()).contains("rust-pilgrims");
        // A unit with the chapter faction keyword is filed under the chapter.
        assertThat(get(Datasheet.class, "ember-wardens:ember-keeper").factionKeywords()).contains("Ember Wardens");
    }

    @Test
    void datasheetFields() {
        Datasheet d = get(Datasheet.class, "rust-pilgrims:rust-prophet");
        assertThat(d.role()).contains("Infantry Character");
        assertThat(d.keywords()).containsExactly("Infantry", "Character");
        assertThat(d.profiles().get(0).invuln()).contains("5+");
        assertThat(d.leaderOf()).containsExactly("rust-pilgrims:pilgrim-warband");
        assertThat(d.loadout()).contains("This model is equipped with: scrap pistol; censer maul.");
        assertThat(get(Datasheet.class, "rust-pilgrims:pilgrim-warband").profiles().get(0).invuln()).isEmpty();
        Datasheet walker = get(Datasheet.class, "rust-pilgrims:scrap-walker");
        assertThat(walker.legends()).isTrue();
        assertThat(all(Datasheet.class)).noneMatch(x -> x.name().equals("Example Thing"));
        assertThat(get(Datasheet.class, "rust-pilgrims:pilgrim-warband").composition()).contains("1 Pilgrim Elder\n9-19 Pilgrims");
    }

    @Test
    void pointsTiersContextsAndWargearCosts() {
        UnitSizeOption ten = get(UnitSizeOption.class, "rust-pilgrims:pilgrim-warband:size:10");
        assertThat(ten.points()).contains(95);
        assertThat(ten.pointsFor(1, Optional.empty())).contains(95);
        assertThat(ten.pointsFor(2, Optional.empty())).contains(95);
        assertThat(ten.pointsFor(3, Optional.empty())).contains(105);
        assertThat(ten.pointsFor(9, Optional.empty())).contains(105);
        assertThat(get(UnitSizeOption.class, "rust-pilgrims:rust-prophet:size:1").tiers()).isEmpty();
        assertThat(get(Datasheet.class, "rust-pilgrims:pilgrim-warband").wargearPoints())
                .singleElement().satisfies(w -> {
                    assertThat(w.name()).isEqualTo("Rust Cannon");
                    assertThat(w.points()).isEqualTo(5);
                });
        UnitSizeOption keeper = get(UnitSizeOption.class, "ember-wardens:ember-keeper:size:1");
        assertThat(keeper.points()).contains(85);
        assertThat(keeper.contexts()).containsExactly("Rust Pilgrims Detachment", "Assigned Agent");
        assertThat(keeper.pointsFor(1, Optional.of("Assigned Agent"))).contains(100);
    }

    @Test
    void weaponsAndKeywordLabels() {
        Weapon pistol = get(Weapon.class, "rust-pilgrims:rust-prophet:w:scrap-pistol");
        assertThat(pistol.range()).isEqualTo("12\"");
        assertThat(pistol.skill()).isEqualTo("3+");
        assertThat(pistol.abilities()).extracting(k -> k.label()).containsExactly("Pistol");
        Weapon maul = get(Weapon.class, "rust-pilgrims:rust-prophet:w:censer-maul-melee");
        assertThat(maul.range()).isEqualTo("Melee");
        assertThat(maul.abilities()).extracting(k -> k.label()).containsExactly("Rending Edge 2");
        Weapon cannon = get(Weapon.class, "rust-pilgrims:pilgrim-warband:w:rust-cannon");
        assertThat(cannon.abilities()).extracting(k -> k.label()).containsExactly("Heavy", "Rending Edge 1: non-VEHICLE");
        assertThat(all(Weapon.class)).noneMatch(w -> w.name().equals("Banner"));
    }

    @Test
    void abilitiesArmyRulesAndOptions() {
        List<Ability> prophet = all(Ability.class).stream().filter(a -> a.ownerKey().equals("rust-pilgrims:rust-prophet")).toList();
        assertThat(prophet).extracting(Ability::name).contains("Shock Strike", "Feel No Pain 5+", "Faith in Rust", "Rusted Sermon");
        assertThat(prophet.stream().filter(a -> a.name().equals("Feel No Pain 5+")).findFirst().orElseThrow().glossaryId()).contains("g:feel-no-pain");
        ArmyRule rule = get(ArmyRule.class, "rust-pilgrims:rule:faith-in-rust");
        assertThat(rule.text().plain()).contains("Command phase");
        Ability damaged = get(Ability.class, "rust-pilgrims:scrap-walker:ab:damaged");
        assertThat(damaged.name()).isEqualTo("Damaged: 1-3 wounds remaining");
        assertThat(get(Ability.class, "rust-pilgrims:scrap-walker:ab:transport").text().plain()).contains("6 models");
        WargearOption o = all(WargearOption.class).get(0);
        assertThat(o.choices()).containsExactly("Rust Cannon", "Flame Lance");
    }

    @Test
    void detachmentsEnhancementsStratagems() {
        Detachment iron = get(Detachment.class, "rust-pilgrims:det:pilgrimage-of-iron");
        assertThat(iron.dpCost()).contains(1);
        assertThat(iron.forceDispositions()).containsExactly("Hold the Line", "Push Forward");
        assertThat(iron.ruleName()).contains("Iron Faith");
        assertThat(get(Detachment.class, "rust-pilgrims:det:ember-host").dpByKeyword()).containsEntry("Ember Wardens", 1);
        assertThat(all(Detachment.class)).noneMatch(d -> d.name().equals("Hull Breach"));
        assertThat(all(ForceDisposition.class)).extracting(ForceDisposition::name).containsExactly("Hold the Line", "Push Forward");

        Enhancement relic = get(Enhancement.class, "rust-pilgrims:det:pilgrimage-of-iron:enh:relic-of-rust");
        assertThat(relic.points()).contains(25);
        assertThat(relic.requiredKeywords()).containsExactly("Rust Pilgrims");
        assertThat(relic.eligibleDatasheets()).containsExactly("rust-pilgrims:rust-prophet");
        assertThat(relic.upgrade()).isFalse();
        Enhancement banner = get(Enhancement.class, "rust-pilgrims:det:pilgrimage-of-iron:enh:banner-of-iron");
        assertThat(banner.upgrade()).isTrue();
        assertThat(banner.grantsLeaderOf()).containsExactly("rust-pilgrims:pilgrim-warband");

        Stratagem will = get(Stratagem.class, "rust-pilgrims:det:pilgrimage-of-iron:strat:iron-will");
        assertThat(will.name()).isEqualTo("Iron Will");
        assertThat(will.cpCost()).contains(1);
        assertThat(will.category()).contains("Battle Tactic");
        assertThat(will.tags().phases()).containsExactlyInAnyOrder(Phase.SHOOTING, Phase.FIGHT);
        assertThat(will.tags().timing()).isEqualTo(Timing.EITHER_TURN);
        assertThat(will.tags().inferred()).isFalse();
        assertThat(will.when().plain()).isEqualTo("Your opponent's Shooting phase or the Fight phase.".replace("'", "’"));
        assertThat(will.effect().plain()).isEqualTo("Until the end of the phase, your unit has Feel No Pain 5+.");
        assertThat(will.restrictions().plain()).isEqualTo("Once per phase.");
        Stratagem core = get(Stratagem.class, "core:strat:command-re-roll");
        assertThat(core.isCore()).isTrue();
        assertThat(core.category()).contains("Strategic Ploy");
        assertThat(core.tags().phases()).containsExactly(Phase.ANY);
        assertThat(all(Stratagem.class)).noneMatch(s -> s.name().equals("Breach") || s.name().equals("Normal Move"));
        assertThat(get(GlossaryEntry.class, "g:normal-move").text().plain()).contains("MAXIMUM DISTANCE");
    }

    @Test
    void reportAndRequiredFiles() {
        Map<String, Integer> counts = set.report().counts().get("rust-pilgrims");
        assertThat(counts).containsEntry("datasheet", 3).containsEntry("detachment", 2).containsEntry("enhancement", 2);
        assertThat(set.report().issues()).anyMatch(i -> i.category().equals("other-game-mode"));
        assertThat(set.report().issues()).anyMatch(i -> i.category().equals("virtual-datasheet"));
        assertThat(set.report().issues()).anyMatch(i -> i.category().equals("wargear-without-profile"));
        assertThatThrownBy(() -> new WahapediaImporter().parse(Map.of("Factions.csv", "id|name|\n".getBytes())))
                .isInstanceOf(ApiException.class).hasMessageContaining("Datasheets.csv");
    }
}
