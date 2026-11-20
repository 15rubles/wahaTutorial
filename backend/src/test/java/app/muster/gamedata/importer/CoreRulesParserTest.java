package app.muster.gamedata.importer;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.gamedata.build.ImportReport;
import app.muster.gamedata.importer.wahapedia.CoreRulesParser;
import app.muster.gamedata.model.BattleSize;
import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.support.Fixtures;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class CoreRulesParserTest {

    final CoreRulesParser.Result r = CoreRulesParser.parse(
            new String(Fixtures.resource("wahapedia/core-rules.html"), StandardCharsets.UTF_8), new ImportReport.Collector());

    GlossaryEntry g(String key) {
        return r.glossary().stream().filter(x -> x.key().equals(key)).findFirst().orElseThrow(() -> new AssertionError(key));
    }

    @Test
    void abilityBlocks() {
        GlossaryEntry rend = g("g:rending-edge");
        assertThat(rend.term()).isEqualTo("Rending Edge");
        assertThat(rend.kind()).isEqualTo(GlossaryKind.WEAPON_ABILITY);
        assertThat(rend.text().plain()).isEqualTo("Each Critical Strike made with this weapon improves its AP by the number shown.");
        assertThat(g("g:shock-strike").kind()).isEqualTo(GlossaryKind.CORE_ABILITY);
        // "LEADER / SUPPORT" becomes two entries.
        assertThat(g("g:leader").text().plain()).isEqualTo("Leaders lead bodyguard units.");
        assertThat(g("g:support").term()).isEqualTo("Support");
    }

    @Test
    void numberedHeadingsBecomeRuleTerms() {
        assertThat(g("g:engagement").kind()).isEqualTo(GlossaryKind.RULE_TERM);
        assertThat(g("g:engagement").text().plain()).isEqualTo("A model is engaged if it is within 1\" of an enemy model.");
        assertThat(g("g:critical-strike").text().plain()).isEqualTo("An unmodified Hit Roll of 6 is a Critical Strike.");
        assertThat(g("g:hit-roll").term()).isEqualTo("Hit Roll");
        assertThat(r.glossary()).noneMatch(x -> x.key().equals("g:battle-basics"));
    }

    @Test
    void battleSizesAndLimitsComeFromTheTableAndItsNotes() {
        assertThat(r.battleSizes()).extracting(BattleSize::name).containsExactly("Skirmish", "Grand Clash");
        BattleSize s = r.battleSizes().get(0);
        assertThat(s.key()).isEqualTo("battle-size:skirmish");
        assertThat(s.pointsLimit()).contains(500);
        assertThat(s.dpBudget()).contains(1);
        assertThat(s.limits()).containsEntry(BattleSize.LIMIT_ENHANCEMENTS, 1)
                .containsEntry(BattleSize.LIMIT_MAX_COPIES, 2)
                .containsEntry(BattleSize.LIMIT_MAX_COPIES_BATTLELINE, 4)
                .containsEntry(BattleSize.LIMIT_MAX_COPIES_DEDICATED_TRANSPORT, 4)
                .containsEntry(BattleSize.LIMIT_MAX_COPIES_EPIC_HERO, 1)
                .containsEntry(BattleSize.LIMIT_MAX_SAME_UPGRADE, 3)
                .containsEntry(BattleSize.LIMIT_SINGLE_DETACHMENT_DP, 2);
        assertThat(r.battleSizes().get(1).limits()).doesNotContainKey(BattleSize.LIMIT_SINGLE_DETACHMENT_DP);
    }

    @Test
    void titleCase() {
        assertThat(CoreRulesParser.titleCase("LETHAL HITS")).isEqualTo("Lethal Hits");
        assertThat(CoreRulesParser.titleCase("TWIN-LINKED")).isEqualTo("Twin-linked");
        assertThat(CoreRulesParser.titleCase("Kept As Is")).isEqualTo("Kept As Is");
    }
}
