package app.muster.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class InviteCodesTest {

    @Test
    void generatesGroupedCodesWithoutAmbiguousCharacters() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 500; i++) {
            String code = InviteCodes.generate();
            assertThat(code).matches("[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}");
            seen.add(code);
        }
        assertThat(seen).hasSize(500);
    }

    @Test
    void normalizesUserInput() {
        assertThat(InviteCodes.normalize(" k7qx m2pa-9dht ")).isEqualTo("K7QX-M2PA-9DHT");
        assertThat(InviteCodes.normalize("abc")).isEqualTo("ABC");
    }
}
