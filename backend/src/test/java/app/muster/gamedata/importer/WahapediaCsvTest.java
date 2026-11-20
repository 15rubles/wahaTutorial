package app.muster.gamedata.importer;

import static org.assertj.core.api.Assertions.assertThat;

import app.muster.gamedata.importer.wahapedia.WahapediaCsv;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class WahapediaCsvTest {

    static WahapediaCsv.Table parse(String s) {
        return WahapediaCsv.parse("T", s.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void readsByHeaderWithBomTrailingSeparatorAndCrlf() {
        var t = parse("﻿id|name|\r\n1|One|\r\n2|Two|\r\n");
        assertThat(t.header()).containsExactly("id", "name");
        assertThat(t.rows()).hasSize(2);
        assertThat(t.rows().get(1).get("name")).isEqualTo("Two");
        assertThat(t.rows().get(1).line()).isEqualTo(3);
    }

    @Test
    void recordsMaySpanLines() {
        var t = parse("id|text|\n1|first line\nsecond line|\n2|x|\n");
        assertThat(t.rows()).hasSize(2);
        assertThat(t.rows().get(0).get("text")).isEqualTo("first line\nsecond line");
        assertThat(t.malformed()).isEmpty();
    }

    @Test
    void reportsMalformedRecords() {
        var t = parse("id|text|\n1|a|b|\n2|ok|\n3|unterminated");
        assertThat(t.rows()).extracting(r -> r.get("id")).containsExactly("2");
        assertThat(t.malformed()).hasSize(2);
    }

    @Test
    void typedAccessors() {
        var r = parse("a|b|c|\n 12 |true|-|\n").rows().get(0);
        assertThat(r.integer("a")).contains(12);
        assertThat(r.flag("b")).isTrue();
        assertThat(r.integer("c")).isEmpty();
        assertThat(r.opt("missing")).isEmpty();
    }
}
