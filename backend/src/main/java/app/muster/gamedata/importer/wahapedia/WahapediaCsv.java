package app.muster.gamedata.importer.wahapedia;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Reads Wahapedia's export format: '|' separated, UTF-8 with BOM, every line (header too) ends with
 * a trailing '|'. Text fields may contain line breaks, so a record ends once it has as many
 * separators as the header has columns. Columns are read by header name, never by position.
 */
public final class WahapediaCsv {

    public record Row(Map<String, String> fields, int line) {
        public String get(String column) {
            return fields.getOrDefault(column, "").trim();
        }

        public Optional<String> opt(String column) {
            String v = get(column);
            return v.isEmpty() ? Optional.empty() : Optional.of(v);
        }

        public boolean flag(String column) {
            return "true".equalsIgnoreCase(get(column));
        }

        public Optional<Integer> integer(String column) {
            String v = get(column).replaceAll("[^0-9-]", "");
            if (v.isEmpty() || v.equals("-")) return Optional.empty();
            try {
                return Optional.of(Integer.parseInt(v));
            } catch (NumberFormatException e) {
                return Optional.empty();
            }
        }
    }

    public record Table(String name, List<String> header, List<Row> rows, List<String> malformed) {
        public static Table empty(String name) {
            return new Table(name, List.of(), List.of(), List.of());
        }
    }

    private WahapediaCsv() {}

    public static Table parse(String name, byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8);
        if (!text.isEmpty() && text.charAt(0) == '﻿') text = text.substring(1);
        text = text.replace("\r\n", "\n").replace('\r', '\n');
        int firstBreak = text.indexOf('\n');
        if (firstBreak < 0) return Table.empty(name);
        List<String> header = new ArrayList<>(List.of(stripTrailing(text.substring(0, firstBreak)).split("\\|", -1)));
        header.replaceAll(String::trim);
        int columns = header.size();
        List<Row> rows = new ArrayList<>();
        List<String> malformed = new ArrayList<>();
        StringBuilder buf = new StringBuilder();
        int line = 1;
        int startLine = 2;
        for (String l : text.substring(firstBreak + 1).split("\n", -1)) {
            line++;
            if (buf.length() == 0) {
                if (l.isEmpty()) continue;
                startLine = line;
                buf.append(l);
            } else {
                buf.append('\n').append(l);
            }
            int seps = count(buf);
            if (seps < columns) continue;
            String record = buf.toString();
            buf.setLength(0);
            if (seps > columns) {
                malformed.add("line " + startLine + ": " + abbreviate(record));
                continue;
            }
            String[] parts = record.split("\\|", -1);
            Map<String, String> fields = new LinkedHashMap<>();
            for (int i = 0; i < columns; i++) fields.put(header.get(i), parts[i]);
            rows.add(new Row(Collections.unmodifiableMap(fields), startLine));
        }
        if (buf.length() > 0) malformed.add("line " + startLine + ": unterminated record " + abbreviate(buf.toString()));
        return new Table(name, List.copyOf(header), rows, malformed);
    }

    private static String stripTrailing(String headerLine) {
        return headerLine.endsWith("|") ? headerLine.substring(0, headerLine.length() - 1) : headerLine;
    }

    private static int count(CharSequence s) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) if (s.charAt(i) == '|') n++;
        return n;
    }

    private static String abbreviate(String s) {
        String one = s.replace('\n', ' ');
        return one.length() > 120 ? one.substring(0, 120) + "..." : one;
    }
}
