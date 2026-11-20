package app.muster.gamedata.build;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.gamedata.model.GlossaryEntry;
import app.muster.gamedata.model.GlossaryKind;
import app.muster.gamedata.model.RulesText;
import app.muster.gamedata.model.Token;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class RulesTextLinkerTest {

    private static GlossaryEntry g(String term, String... aliases) {
        return new GlossaryEntry(Keys.glossary(term), term, List.of(aliases), GlossaryKind.RULE_TERM, RulesText.EMPTY, List.of(), List.of());
    }

    private final RulesTextLinker linker = new RulesTextLinker(List.of(
            g("Rending Edge"), g("Rending"), g("Critical Strike", "Critical Strikes"), g("Anti"), g("Infantry"), g("Shock Strike")));

    @Test
    void linksLongestMatchFirstWithParameter() {
        List<Token> t = linker.link("This weapon has Rending Edge 2 against targets.", Optional.empty());
        assertThat(t).containsExactly(
                new Token.Text("This weapon has "),
                new Token.Ref("g:rending-edge", "Rending Edge 2"),
                new Token.Text(" against targets."));
    }

    @Test
    void caseInsensitiveWholeWordsAndAliases() {
        List<Token> t = linker.link("Each critical strikes counts; INFANTRYMAN is not infantry.", Optional.empty());
        assertThat(t).contains(new Token.Ref("g:critical-strike", "critical strikes"), new Token.Ref("g:infantry", "infantry"));
        assertThat(t.stream().filter(x -> x instanceof Token.Ref).count()).isEqualTo(2);
    }

    @Test
    void hyphenatedParameterForm() {
        List<Token> t = linker.link("It has Anti-Infantry 4+.", Optional.empty());
        assertThat(t).contains(new Token.Ref("g:anti", "Anti-Infantry 4+"));
    }

    @Test
    void neverLinksToItself() {
        List<Token> t = linker.link("Shock Strike units arrive later.", Optional.of("g:shock-strike"));
        assertThat(t).containsExactly(new Token.Text("Shock Strike units arrive later."));
    }

    @Test
    void resolvesPrintedWeaponKeywords() {
        assertThat(linker.resolve("Rending Edge 1")).contains("g:rending-edge");
        assertThat(linker.resolve("anti-infantry 4+")).contains("g:anti");
        assertThat(linker.resolve("Unknown Thing")).isEmpty();
    }

    @Test
    void emptyGlossaryKeepsText() {
        RulesTextLinker none = new RulesTextLinker(List.of());
        assertThat(none.link("abc", Optional.empty())).containsExactly(new Token.Text("abc"));
        assertThat(none.link("", Optional.empty())).isEmpty();
        assertThat(none.resolve("abc")).isEmpty();
    }
}
