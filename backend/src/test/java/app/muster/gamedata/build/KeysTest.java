package app.muster.gamedata.build;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class KeysTest {

    @Test
    void slugsAreStableAcrossSpellings() {
        assertThat(Keys.slug("Rust Prophet")).isEqualTo("rust-prophet");
        assertThat(Keys.slug("Ka'rel the Rusted")).isEqualTo("karel-the-rusted");
        assertThat(Keys.slug("Ka’rel  the   Rusted")).isEqualTo("karel-the-rusted");
        assertThat(Keys.slug("Émber Wärden")).isEqualTo("ember-warden");
        assertThat(Keys.slug("Scrap Walker [Legends]")).isEqualTo("scrap-walker");
        assertThat(Keys.slug("!!!")).isEqualTo("unnamed");
    }

    @Test
    void matchNameIgnoresPlural() {
        assertThat(Keys.matchName("Pilgrim Warbands")).isEqualTo(Keys.matchName("Pilgrim Warband"));
    }

    @Test
    void keyShapes() {
        String ds = Keys.datasheet("rust-pilgrims", "Rust Prophet");
        assertThat(ds).isEqualTo("rust-pilgrims:rust-prophet");
        assertThat(Keys.unitSize(ds, 10)).isEqualTo("rust-pilgrims:rust-prophet:size:10");
        assertThat(Keys.detachment("rust-pilgrims", "Ember Host")).isEqualTo("rust-pilgrims:det:ember-host");
        assertThat(Keys.glossary("Shock Strike")).isEqualTo("g:shock-strike");
    }
}
