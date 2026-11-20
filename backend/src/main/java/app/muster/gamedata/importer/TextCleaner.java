package app.muster.gamedata.importer;

import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;

/** Turns source markup (BattleScribe markdown-ish text, Wahapedia HTML) into plain rules text. */
public final class TextCleaner {

    private static final Pattern MULTI_BLANK = Pattern.compile("\n{3,}");
    private static final Pattern SPACES = Pattern.compile("[ \\t\\x0B\\f\\u00A0]+");

    private TextCleaner() {}

    /** BattleScribe descriptions: strip **bold** and ^^keyword^^ markers, keep paragraphs and bullets. */
    public static String battleScribe(String raw) {
        if (raw == null) return "";
        String s = raw.replace("\r\n", "\n").replace('\r', '\n');
        s = s.replace("^^", "").replace("**", "");
        s = s.replace("■", "•");
        return tidy(s);
    }

    /** HTML to text with paragraphs and list items on their own lines. */
    public static String html(String html) {
        if (html == null || html.isBlank()) return "";
        Document doc = Jsoup.parseBodyFragment(html);
        // Ability heading boxes ("DEEP STRIKE 24.09"), section codes and flavour text are not rules text.
        doc.select("script, style, .tooltip_templates, .noprint, .abNameWrap, .h_number, .ShowFluff, .abLegend").remove();
        StringBuilder sb = new StringBuilder();
        walk(doc.body(), sb);
        return tidy(sb.toString().replace("■", "•"));
    }

    private static void walk(Node node, StringBuilder sb) {
        for (Node child : node.childNodes()) {
            if (child instanceof TextNode t) {
                sb.append(t.getWholeText().replace('\n', ' '));
            } else if (child instanceof Element e) {
                String tag = e.normalName();
                switch (tag) {
                    case "br" -> sb.append('\n');
                    case "li" -> {
                        sb.append("\n• ");
                        walk(e, sb);
                        sb.append('\n');
                    }
                    case "p", "div", "ul", "ol", "table", "tr", "h1", "h2", "h3", "h4", "h5", "h6" -> {
                        sb.append('\n');
                        walk(e, sb);
                        sb.append('\n');
                    }
                    case "td", "th" -> {
                        walk(e, sb);
                        sb.append(' ');
                    }
                    default -> walk(e, sb);
                }
            }
        }
    }

    public static String tidy(String s) {
        String[] lines = s.split("\n", -1);
        StringBuilder out = new StringBuilder();
        for (String line : lines) {
            String l = SPACES.matcher(line).replaceAll(" ").strip();
            out.append(l).append('\n');
        }
        String r = MULTI_BLANK.matcher(out.toString()).replaceAll("\n\n").strip();
        // Long dashes never appear in our output (DESIGN.md 0.5).
        return r.replace('—', '-').replace('–', '-');
    }
}
