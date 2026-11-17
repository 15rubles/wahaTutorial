/**
 * Core rules page HTML -> RuleSection tree with stable ids.
 *
 * Page shape (see docs/data-schema.md): a flat run of blocks. A section starts at a "marker":
 * an h2 / h3 heading, a `div.abName` (core ability box) or a `div.str11Name` (rule box). Coded
 * markers carry `<span class="h_number">05.01</span>`; the dotted code, not the heading level,
 * gives the hierarchy. `h2.super_header` headings are groups ("BASIC RULES"). Headings with an id
 * but no code are sub-sections of the nearest coded section. Everything between two markers is the
 * body of the first one.
 */
import { type HTMLElement, parse } from 'node-html-parser';
import type { RuleSection } from '../schema.js';
import { slugify } from '../weaponKeywords.js';

export interface ParseCoreRulesOptions {
  /** Canonical page URL, used for sourceUrl and to recognise in-page links. */
  readonly pageUrl: string;
  /** Origin used to make other site links absolute. */
  readonly origin?: string;
}

export interface CoreRules {
  readonly roots: RuleSection[];
  /** Page anchor (heading id) -> rule id, for in-page links. */
  readonly anchors: Record<string, string>;
  /** Section code (`05.01`) -> rule id. */
  readonly codes: Record<string, string>;
}

interface Marker {
  start: number;
  end: number;
  kind: RuleSection['kind'];
  codes: string[];
  title: string;
  anchor: string;
}

const CODE = /^\d\d(?:\.\d\d){0,3}$/;

function textOf(html: string): string {
  return parse(html).textContent.replace(/\s+/g, ' ').trim();
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/^\d\d(?:\.\d\d)+\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[[\]]/g, '')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMarkers(html: string): Marker[] {
  const markers: Marker[] = [];
  const headingRe = /<(h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  const boxRe = /<div\b([^>]*\bclass="[^"]*\b(abName|str11Name)\b[^"]*"[^>]*)>([\s\S]*?)<\/div>/g;

  // Codes are in span.h_number, or div.h_number_red / h_number_red2 for top level sections.
  const codesIn = (inner: string) =>
    [...inner.matchAll(/class="h_number\w*"[^>]*>\s*(\d\d(?:\.\d\d)*)/g)].map((m) => m[1]!);
  const withoutCodes = (inner: string) =>
    inner.replace(/(class="h_number\w*"[^>]*>)\s*\d\d(?:\.\d\d)*/g, '$1');
  const attr = (attrs: string, name: string) =>
    new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? '';

  for (const m of html.matchAll(headingRe)) {
    const attrs = m[2]!;
    const inner = m[3]!;
    const id = attr(attrs, 'id');
    const codes = codesIn(inner);
    let title = textOf(withoutCodes(inner));
    const leading = /^(\d\d(?:\.\d\d)+)\s+/.exec(title);
    if (leading && codes.length === 0) codes.push(leading[1]!);
    title = cleanTitle(title);
    const isGroup = /\bsuper_header\b/.test(attr(attrs, 'class'));
    if (!id && codes.length === 0) continue; // FAQ / Errata / decorative headings stay in the body
    markers.push({
      start: m.index,
      end: m.index + m[0].length,
      kind: isGroup ? 'group' : 'section',
      codes: codes.filter((c) => CODE.test(c)),
      title,
      anchor: id,
    });
  }
  for (const m of html.matchAll(boxRe)) {
    const attrs = m[1]!;
    const inner = m[3]!;
    const codes = codesIn(inner).filter((c) => CODE.test(c));
    if (codes.length === 0) continue;
    markers.push({
      start: m.index,
      end: m.index + m[0].length,
      kind: m[2] === 'abName' ? 'ability' : 'section',
      codes,
      title: cleanTitle(textOf(withoutCodes(inner))),
      anchor: attr(attrs, 'id'),
    });
  }
  markers.sort((a, b) => a.start - b.start);

  // A code can appear in more than one box (summary boxes that list several abilities). Keep, for
  // each code, the first single-code marker; drop multi-code markers whose codes all exist elsewhere.
  const single = new Map<string, Marker>();
  for (const mk of markers)
    if (mk.codes.length === 1 && !single.has(mk.codes[0]!)) single.set(mk.codes[0]!, mk);
  const seen = new Set<string>();
  return markers.filter((mk) => {
    if (mk.codes.length === 0) return true;
    if (mk.codes.length > 1) {
      if (mk.codes.every((c) => single.has(c))) return false;
      mk.codes = [mk.codes[0]!];
    }
    const code = mk.codes[0]!;
    if (seen.has(code)) return false;
    if (single.get(code) && single.get(code) !== mk) return false;
    seen.add(code);
    return true;
  });
}

function cleanBody(
  html: string,
  origin: string,
  linkTarget: (path: string, anchor: string) => string | undefined,
): string {
  // No wrapper element: fragments start with stray closing tags that would close a wrapper early.
  const top: HTMLElement = parse(html, { comment: false });
  top
    .querySelectorAll(
      'script, style, ins, iframe, img, form, .tooltip_templates, .btnFaqErrataToggle',
    )
    .forEach((el) => el.remove());
  // Dice face icons are CSS sprites: turn them into text.
  top.querySelectorAll('div').forEach((el) => {
    const m = /\bcruD(\d)\b/.exec(el.getAttribute('class') ?? '');
    if (m) el.replaceWith(`<span class="die">${m[1]}</span>`);
  });
  // FAQ / errata spoilers -> <details>.
  top.querySelectorAll('.faqErrataSpoiler').forEach((el) => {
    const head = el.querySelector('.faqErrataHead');
    const label = head?.textContent.trim() || 'FAQ';
    const body = el.querySelector('.faqErrataSpoilerBody')?.innerHTML ?? '';
    const kind = /errata/i.test(label) ? 'errata' : 'faq';
    el.replaceWith(`<details class="rule-${kind}"><summary>${label}</summary>${body}</details>`);
  });
  // Tooltip wrappers carry no meaning without the site scripts.
  for (let pass = 0; pass < 3; pass++) {
    top.querySelectorAll('span').forEach((el) => {
      const cls = el.getAttribute('class') ?? '';
      if (/\btooltip\d+\b|\btt\b/.test(cls) || el.hasAttribute('data-tooltip-content'))
        el.replaceWith(el.innerHTML);
    });
  }
  top.querySelectorAll('a').forEach((el) => {
    const href = el.getAttribute('href');
    if (!href) {
      if (!el.innerHTML.trim()) el.remove();
      return;
    }
    let url: URL;
    try {
      url = new URL(href, origin);
    } catch {
      el.replaceWith(el.innerHTML);
      return;
    }
    // Only http(s) links survive; anything else (javascript:, data:) becomes plain text.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      el.replaceWith(el.innerHTML);
      return;
    }
    const target = url.hash
      ? linkTarget(url.pathname, decodeURIComponent(url.hash.slice(1)))
      : undefined;
    if (target) el.setAttribute('href', `#rule:${target}`);
    else {
      el.setAttribute('href', url.toString());
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noreferrer');
    }
  });
  const KEEP = new Set(['class', 'href', 'target', 'rel', 'colspan', 'rowspan']);
  top.querySelectorAll('*').forEach((el) => {
    for (const name of Object.keys(el.attributes))
      if (!KEEP.has(name.toLowerCase())) el.removeAttribute(name);
  });
  return top.innerHTML.replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>').trim();
}

export interface RulesPage {
  readonly html: string;
  readonly pageUrl: string;
}

interface PageParts {
  region: string;
  markers: Marker[];
  glossary: { code: string; title: string; html: string; href: string }[];
}

function pageParts(html: string): PageParts {
  const startIdx = html.search(/class="page_header"/);
  const fromStart = startIdx >= 0 ? html.slice(html.lastIndexOf('<', startIdx)) : html;
  // Main content ends where the site footer / login template begins.
  const endIdx = fromStart.indexOf('<!--noindex-->');
  const content = endIdx >= 0 ? fromStart.slice(0, endIdx) : fromStart;
  // Tooltip templates hold a glossary of numbered sub-rules ("01.05.03 Modifying Dice Rolls"). They
  // sit at the end of the page, outside the content region.
  const glossary: PageParts['glossary'] = [];
  for (const tip of parse(fromStart, { comment: false }).querySelectorAll(
    '.tooltip_templates > span',
  )) {
    const header = tip.querySelector('.tooltip_header');
    const m = /^(\d\d(?:\.\d\d)+)\s+(.+)$/.exec(header?.textContent.trim() ?? '');
    if (!header || !m) continue;
    const href = tip.querySelector('a')?.getAttribute('href') ?? '';
    header.remove();
    tip
      .querySelectorAll('.tooltip_link')
      .forEach((el) => (el.parentNode?.tagName === 'A' ? el.parentNode.remove() : el.remove()));
    glossary.push({ code: m[1]!, title: cleanTitle(m[2]!), html: tip.innerHTML, href });
  }
  // Drop templates inside the content too: they repeat ability boxes and would create false markers.
  const pre = parse(content, { comment: false });
  pre.querySelectorAll('.tooltip_templates, script, style').forEach((el) => el.remove());
  const region = pre.toString();
  return { region, markers: findMarkers(region), glossary };
}

/**
 * Parses the core rules page plus optional extra pages (the rules appendix). The first page gives the
 * structure. Extra pages contribute coded sections that the first page lacks, attached by code, with
 * their uncoded sub-headings. Glossary tooltips fill any code still missing.
 */
export function parseCoreRules(
  html: string,
  options: ParseCoreRulesOptions,
  extraPages: readonly RulesPage[] = [],
): CoreRules {
  const origin = options.origin ?? new URL(options.pageUrl).origin;
  const pages = [{ html, pageUrl: options.pageUrl }, ...extraPages].map((pg) => ({
    ...pg,
    path: new URL(pg.pageUrl).pathname,
    ...pageParts(pg.html),
  }));

  const anchors: Record<string, string> = {};
  const pageAnchors = new Map<string, Record<string, string>>(pages.map((pg) => [pg.path, {}]));
  const codes: Record<string, string> = {};
  const usedIds = new Set<string>();
  const makeId = (path: string[], code: string): string => {
    let id = ['core', ...path].join('.');
    if (usedIds.has(id) && code) id = `${id}-${code.replace(/\./g, '-')}`;
    const base = id;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };

  interface Pending {
    node: RuleSection;
    raw: string;
    slug: string;
    page: string;
    group: Pending | undefined;
    prevCoded: Pending | undefined;
  }
  const pending: Pending[] = [];
  const byCode = new Map<string, Pending>();
  const newNode = (
    fields: Pick<RuleSection, 'number' | 'title' | 'kind' | 'anchor' | 'sourceUrl'>,
    slug: string,
  ): RuleSection => ({
    id: '',
    html: '',
    text: '',
    keywords: fields.kind === 'ability' ? [slug] : [],
    children: [],
    ...fields,
  });

  // Pass 1: one node per marker, remembering its group and the previous coded node.
  pages.forEach((pg, pageIndex) => {
    let group: Pending | undefined;
    let prevCoded: Pending | undefined;
    let skipping = false;
    pg.markers.forEach((mk, i) => {
      const raw = pg.region.slice(mk.end, pg.markers[i + 1]?.start ?? pg.region.length);
      const code = mk.codes[0] ?? '';
      const slug = slugify(mk.title) || slugify(mk.anchor) || 'section';
      if (pageIndex > 0) {
        // Extra pages: only new codes and the uncoded headings under them.
        if (mk.kind === 'group') return;
        if (code) {
          skipping = byCode.has(code);
          if (skipping) return;
        } else if (skipping || !prevCoded) return;
      }
      const node = newNode(
        {
          number: code,
          title: mk.title,
          kind: mk.kind,
          anchor: mk.anchor || slug,
          sourceUrl: `${pg.pageUrl}${mk.anchor ? `#${mk.anchor}` : ''}`,
        },
        slug,
      );
      const p: Pending = {
        node,
        raw,
        slug,
        page: pg.path,
        group: mk.kind === 'group' ? undefined : group,
        prevCoded,
      };
      pending.push(p);
      if (mk.kind === 'group') {
        group = p;
        prevCoded = undefined;
      } else if (code) {
        byCode.set(code, p);
        prevCoded = p;
      }
    });
  });

  // Glossary entries for codes that still have no section.
  for (const g of pages.flatMap((pg) => pg.glossary)) {
    if (byCode.has(g.code)) continue;
    const slug = slugify(g.title) || 'section';
    // An uncoded heading with the same title under the same parent is this entry: give it the code.
    const parentCode = g.code.split('.').slice(0, -1).join('.');
    const twin = pending.find(
      (p) =>
        !p.node.number &&
        p.node.kind !== 'group' &&
        p.slug === slug &&
        p.prevCoded?.node.number === parentCode,
    );
    if (twin) {
      twin.node.number = g.code;
      byCode.set(g.code, twin);
      continue;
    }
    let sourceUrl = options.pageUrl;
    let anchor = slug;
    let page = pages[0]!.path;
    try {
      const u = new URL(g.href, origin);
      sourceUrl = u.toString();
      anchor = decodeURIComponent(u.hash.slice(1)) || slug;
      page = u.pathname;
    } catch {
      // keep defaults
    }
    const p: Pending = {
      node: newNode({ number: g.code, title: g.title, kind: 'section', anchor, sourceUrl }, slug),
      raw: g.html,
      slug,
      page,
      group: undefined,
      prevCoded: undefined,
    };
    pending.push(p);
    byCode.set(g.code, p);
  }

  // Pass 2: parents. Coded nodes hang under the longest existing code prefix, wherever they are in
  // the page (some boxes appear before their parent section). Uncoded headings hang under the
  // previous coded node. Everything else goes under its group.
  const parentOf = new Map<Pending, Pending | undefined>();
  for (const p of pending) {
    if (p.node.kind === 'group') continue;
    let parent: Pending | undefined;
    if (p.node.number) {
      const segs = p.node.number.split('.');
      for (let n = segs.length - 1; n > 0 && !parent; n--)
        parent = byCode.get(segs.slice(0, n).join('.'));
    } else parent = p.prevCoded;
    parentOf.set(p, parent ?? p.group);
  }
  const roots: RuleSection[] = [];
  const pathOf = new Map<Pending, string[]>();
  const resolvePath = (p: Pending): string[] => {
    const cached = pathOf.get(p);
    if (cached) return cached;
    const parent = parentOf.get(p);
    const path =
      p.node.kind === 'group'
        ? ['group', p.slug]
        : parent && parent.node.kind !== 'group'
          ? [...resolvePath(parent), p.slug]
          : [p.slug];
    pathOf.set(p, path);
    return path;
  };
  for (const p of pending) {
    p.node.id = makeId(resolvePath(p), p.node.number);
    const parent = parentOf.get(p);
    (parent ? parent.node.children : roots).push(p.node);
    const own = pageAnchors.get(p.page);
    if (own && p.node.anchor && !(p.node.anchor in own)) own[p.node.anchor] = p.node.id;
    if (p.page === pages[0]!.path && p.node.anchor && !(p.node.anchor in anchors))
      anchors[p.node.anchor] = p.node.id;
    if (p.node.number) codes[p.node.number] = p.node.id;
  }
  sortChildren(roots);

  const linkTarget = (path: string, anchor: string): string | undefined =>
    pageAnchors.get(path)?.[anchor];
  for (const p of pending) {
    p.node.html = cleanBody(p.raw, origin, linkTarget);
    p.node.text = textOf(p.node.html);
  }
  return { roots, anchors, codes };
}

/** Coded children in code order; uncoded children stay right after the coded sibling before them. */
function sortChildren(nodes: RuleSection[]): void {
  const key = new Map<RuleSection, string>();
  let last = '';
  nodes.forEach((n, i) => {
    if (n.number) last = n.number;
    key.set(
      n,
      `${last
        .split('.')
        .map((x) => x.padStart(3, '0'))
        .join('.')}|${n.number ? 0 : 1}|${String(i).padStart(4, '0')}`,
    );
  });
  nodes.sort((a, b) => (key.get(a)! < key.get(b)! ? -1 : 1));
  nodes.forEach((n) => sortChildren(n.children));
}

export function flattenRules(roots: readonly RuleSection[]): RuleSection[] {
  const out: RuleSection[] = [];
  const walk = (n: RuleSection) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}
