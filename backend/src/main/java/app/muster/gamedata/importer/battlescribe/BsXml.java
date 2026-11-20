package app.muster.gamedata.importer.battlescribe;

import app.muster.common.ApiException;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

/** Small DOM helpers for BattleScribe XML (parsed namespace-unaware, with XXE disabled). */
final class BsXml {

    private BsXml() {}

    static Document parse(String fileName, byte[] xml) {
        try {
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            f.setNamespaceAware(false);
            f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setFeature("http://xml.org/sax/features/external-general-entities", false);
            f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            f.setXIncludeAware(false);
            f.setExpandEntityReferences(false);
            DocumentBuilder b = f.newDocumentBuilder();
            b.setErrorHandler(null);
            return b.parse(new ByteArrayInputStream(xml));
        } catch (Exception e) {
            throw ApiException.badRequest("BAD_XML", fileName + " is not valid BattleScribe XML: " + e.getMessage());
        }
    }

    /** Direct child elements with the given tag. */
    static List<Element> children(Element parent, String tag) {
        List<Element> out = new ArrayList<>();
        for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n instanceof Element e && e.getTagName().equals(tag)) out.add(e);
        }
        return out;
    }

    /** Elements under a wrapper: children(parent, "profiles") then their "profile" children. */
    static List<Element> list(Element parent, String wrapper, String tag) {
        List<Element> out = new ArrayList<>();
        for (Element w : children(parent, wrapper)) out.addAll(children(w, tag));
        return out;
    }

    static Optional<Element> child(Element parent, String tag) {
        List<Element> c = children(parent, tag);
        return c.isEmpty() ? Optional.empty() : Optional.of(c.get(0));
    }

    static String attr(Element e, String name) {
        return e.hasAttribute(name) ? e.getAttribute(name) : "";
    }

    static boolean flag(Element e, String name) {
        return "true".equalsIgnoreCase(attr(e, name));
    }

    static Optional<Integer> intAttr(Element e, String name) {
        try {
            String v = attr(e, name);
            if (v.isBlank()) return Optional.empty();
            return Optional.of((int) Math.round(Double.parseDouble(v)));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }

    static String text(Element e) {
        return e.getTextContent() == null ? "" : e.getTextContent();
    }

    /** Description of a rule element. */
    static String description(Element rule) {
        return child(rule, "description").map(BsXml::text).orElse("");
    }
}
