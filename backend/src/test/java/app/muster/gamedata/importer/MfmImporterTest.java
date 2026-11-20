package app.muster.gamedata.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.muster.common.ApiException;
import app.muster.gamedata.build.SourceSet;
import app.muster.gamedata.importer.mfm.MfmImporter;
import app.muster.gamedata.model.EntityType;
import app.muster.support.Fixtures;
import org.junit.jupiter.api.Test;

class MfmImporterTest {

    @Test
    void readsUnitSizesAndEnhancementsFromAPdf() {
        SourceSet set = new MfmImporter().importPdf(Fixtures.mfmPdf(Fixtures.MFM_LINES));
        assertThat(set.items()).anySatisfy(i -> {
            assertThat(i.type()).isEqualTo(EntityType.UNIT_SIZE);
            assertThat(i.key()).isEqualTo("rust-pilgrims:pilgrim-warband:size:20");
            assertThat(i.data().get("points").asInt()).isEqualTo(190);
            assertThat(i.data().get("datasheet").asText()).isEqualTo("rust-pilgrims:pilgrim-warband");
        });
        assertThat(set.items()).anySatisfy(i -> {
            assertThat(i.key()).isEqualTo("rust-pilgrims:pilgrim-warband:size:10");
            assertThat(i.data().get("points").asInt()).isEqualTo(100);
        });
        assertThat(set.items()).anySatisfy(i -> {
            assertThat(i.type()).isEqualTo(EntityType.ENHANCEMENT);
            assertThat(i.key()).isEqualTo("rust-pilgrims:det:pilgrimage-of-iron:enh:relic-of-rust");
            assertThat(i.data().get("points").asInt()).isEqualTo(30);
        });
        assertThat(set.items()).anySatisfy(i -> assertThat(i.key()).isEqualTo("ember-wardens:ember-keeper:size:1"));
    }

    @Test
    void notAnMfm() {
        assertThatThrownBy(() -> new MfmImporter().parseText("hello\nworld")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> new MfmImporter().importPdf("nope".getBytes())).isInstanceOf(ApiException.class);
    }
}
