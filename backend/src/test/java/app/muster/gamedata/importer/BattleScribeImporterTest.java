package app.muster.gamedata.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.muster.common.ApiException;
import app.muster.gamedata.build.GameJson;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.importer.battlescribe.BattleScribeImporter;
import app.muster.gamedata.model.Ability;
import app.muster.gamedata.model.Allegiance;
import app.muster.gamedata.model.ArmyRule;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.Datasheet;
import app.muster.gamedata.model.Detachment;
import app.muster.gamedata.model.EntityType;
import app.muster.gamedata.model.Enhancement;
import app.muster.gamedata.model.Faction;
import app.muster.gamedata.model.GameEntity;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.gamedata.model.UnitSizeOption;
import app.muster.gamedata.model.WargearOption;
import app.muster.gamedata.model.Weapon;
import app.muster.gamedata.model.WeaponType;
import app.muster.support.Fixtures;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class BattleScribeImporterTest {

    static SourceSet set;

    @BeforeAll
    static void parse() {
        set = new BattleScribeImporter().importZip(Fixtures.battleScribeZip());
    }

    static <T extends GameEntity> T get(Class<T> type, String key) {
        return all(type).stream().filter(e -> e.key().equals(key)).findFirst().orElseThrow(() -> new AssertionError("missing " + key));
    }

    @SuppressWarnings("unchecked")
    static <T extends GameEntity> List<T> all(Class<T> type) {
        EntityType et = java.util.Arrays.stream(EntityType.values()).filter(t -> t.recordType() == type).findFirst().orElseThrow();
        return set.items().stream().filter(i -> i.type() == et).map(i -> (T) GameJson.fromNode(i.data(), et)).toList();
    }

    @Test
    void factionsWithAllegianceAndParent() {
        Faction rp = get(Faction.class, "rust-pilgrims");
        assertThat(rp.name()).isEqualTo("Rust Pilgrims");
        assertThat(rp.allegiance()).contains(Allegiance.IMPERIUM);
        assertThat(rp.parentKey()).isEmpty();
        assertThat(get(Faction.class, "ember-wardens").parentKey()).contains("rust-pilgrims");
        // Libraries are not factions.
        assertThat(all(Faction.class)).extracting(Faction::key).containsExactlyInAnyOrder("rust-pilgrims", "ember-wardens");
    }

    @Test
    void datasheetWithProfilesKeywordsAndLeader() {
        Datasheet p = get(Datasheet.class, "rust-pilgrims:rust-prophet");
        assertThat(p.role()).contains("Character");
        assertThat(p.keywords()).containsExactly("Character", "Infantry");
        assertThat(p.factionKeywords()).containsExactly("Rust Pilgrims");
        assertThat(p.profiles()).hasSize(1);
        assertThat(p.profiles().get(0).m()).isEqualTo("6\"");
        assertThat(p.profiles().get(0).invuln()).contains("5+");
        assertThat(p.leaderOf()).containsExactly("rust-pilgrims:pilgrim-warband");
        assertThat(p.maxCopies()).contains(1);
        assertThat(p.legends()).isFalse();
    }

    @Test
    void legendsFlagAndLibraryUnits() {
        Datasheet walker = get(Datasheet.class, "rust-pilgrims:scrap-walker");
        assertThat(walker.legends()).isTrue();
        assertThat(walker.name()).isEqualTo("Scrap Walker");
        assertThat(get(Datasheet.class, "rust-pilgrims:hired-gun").faction()).isEqualTo("rust-pilgrims");
    }

    @Test
    void weaponsWithKeywords() {
        Weapon maul = get(Weapon.class, "rust-pilgrims:rust-prophet:w:censer-maul-melee");
        assertThat(maul.weaponType()).isEqualTo(WeaponType.MELEE);
        assertThat(maul.skill()).isEqualTo("2+");
        assertThat(maul.ap()).isEqualTo("-1");
        assertThat(maul.abilities()).extracting(k -> k.label()).containsExactly("Rending Edge 2");
        Weapon rifle = get(Weapon.class, "rust-pilgrims:pilgrim-warband:w:rust-rifle");
        assertThat(rifle.abilities()).isEmpty();
        assertThat(rifle.range()).isEqualTo("24\"");
    }

    @Test
    void unitSizesFromModelConstraintsAndModifiers() {
        assertThat(get(UnitSizeOption.class, "rust-pilgrims:pilgrim-warband:size:10").points()).contains(90);
        assertThat(get(UnitSizeOption.class, "rust-pilgrims:pilgrim-warband:size:20").points()).contains(180);
        assertThat(get(UnitSizeOption.class, "rust-pilgrims:rust-prophet:size:1").points()).contains(70);
    }

    @Test
    void wargearOptionGroups() {
        WargearOption o = get(WargearOption.class, "rust-pilgrims:pilgrim-warband:opt:heavy-weapons");
        assertThat(o.choices()).containsExactly("Rust Cannon", "Flame Lance");
        assertThat(o.max()).contains(1);
        assertThat(o.perModels()).contains(10);
        assertThat(o.pointsDelta()).contains(5);
    }

    @Test
    void abilitiesIncludingCoreRuleLinks() {
        List<Ability> abilities = all(Ability.class).stream().filter(a -> a.ownerKey().equals("rust-pilgrims:rust-prophet")).toList();
        assertThat(abilities).extracting(Ability::name).contains("Leader", "Invulnerable Save", "Rusted Sermon", "Shock Strike");
        Ability shock = abilities.stream().filter(a -> a.name().equals("Shock Strike")).findFirst().orElseThrow();
        assertThat(shock.glossaryId()).contains("g:shock-strike");
        assertThat(abilities.stream().filter(a -> a.name().equals("Leader")).findFirst().orElseThrow().text().plain())
                .contains("• Pilgrim Warband");
    }

    @Test
    void detachmentsEnhancementsAndArmyRules() {
        Detachment iron = get(Detachment.class, "rust-pilgrims:det:pilgrimage-of-iron");
        assertThat(iron.dpCost()).contains(1);
        assertThat(iron.ruleName()).contains("Iron Faith");
        assertThat(iron.ruleText().plain()).contains("Shooting phase");
        assertThat(get(Detachment.class, "rust-pilgrims:det:ember-host").dpCost()).contains(2);
        Enhancement relic = get(Enhancement.class, "rust-pilgrims:det:pilgrimage-of-iron:enh:relic-of-rust");
        assertThat(relic.points()).contains(20);
        assertThat(relic.requiredKeywords()).containsExactly("Character");
        assertThat(relic.text().plain()).contains("Fight phase");
        ArmyRule rule = get(ArmyRule.class, "rust-pilgrims:rule:faith-in-rust");
        assertThat(rule.text().plain()).contains("Command phase");
        assertThat(all(Ability.class)).anyMatch(a -> a.ownerKey().equals(rule.key()));
    }

    @Test
    void battleSizesAndGlossary() {
        assertThat(get(BattleSize.class, "battle-size:skirmish").pointsLimit()).contains(500);
        assertThat(get(BattleSize.class, "battle-size:grand-clash").pointsLimit()).contains(2000);
        assertThat(get(BattleSize.class, "battle-size:grand-clash").dpBudget()).isEmpty();
        GlossaryEntry rend = get(GlossaryEntry.class, "g:rending-edge");
        assertThat(rend.kind()).isEqualTo(GlossaryKind.WEAPON_ABILITY);
        assertThat(rend.text().plain()).isEqualTo("Each Critical Strike made with this weapon improves its AP by the number shown.");
        assertThat(get(GlossaryEntry.class, "g:shock-strike").kind()).isEqualTo(GlossaryKind.CORE_ABILITY);
    }

    @Test
    void reportCountsPerFaction() {
        Map<String, Integer> counts = set.report().counts().get("rust-pilgrims");
        assertThat(counts).containsEntry("datasheet", 4).containsEntry("detachment", 2).containsEntry("enhancement", 1);
        assertThat(set.report().issues()).anyMatch(i -> i.category().equals("library"));
    }

    @Test
    void rejectsXxe() {
        String evil = """
                <?xml version="1.0"?>
                <!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
                <gameSystem id="s" name="&xxe;"/>
                """;
        assertThatThrownBy(() -> new BattleScribeImporter().parse(Map.of("a.gst", evil.getBytes(StandardCharsets.UTF_8))))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not valid BattleScribe XML");
    }

    @Test
    void requiresOneGameSystem() {
        assertThatThrownBy(() -> new BattleScribeImporter().parse(Map.of()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("exactly one .gst");
    }
}
