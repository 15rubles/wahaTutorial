/**
 * BattleScribe / New Recruit roster XML (`.ros`) and zipped XML (`.rosz`).
 * Shape: roster > forces > force > selections > selection (type unit | model | upgrade), nested
 * selections for models and wargear, costs > cost[name=pts].
 */
import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';
import type { DraftItem, DraftModel, DraftUnit, RosterDraft } from './types.js';

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  isArray: (name) => ['force', 'selection', 'cost', 'category'].includes(name),
  parseAttributeValue: false,
});

const arr = (v: unknown): XmlNode[] =>
  Array.isArray(v) ? (v as XmlNode[]) : v ? [v as XmlNode] : [];
const str = (v: unknown): string =>
  typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
const selections = (n: XmlNode): XmlNode[] =>
  arr((n['selections'] as XmlNode | undefined)?.['selection']);
const num = (n: XmlNode): number => Math.max(1, Number(str(n['number'])) || 1);
const type = (n: XmlNode): string => str(n['type']).toLowerCase();

function pts(n: XmlNode): number {
  const costs = arr((n['costs'] as XmlNode | undefined)?.['cost']);
  const c = costs.find((x) => /^(pts|points)$/i.test(str(x['name'])));
  return c ? Number(str(c['value'])) || 0 : 0;
}

function totalPts(n: XmlNode): number {
  return pts(n) + selections(n).reduce((sum, child) => sum + totalPts(child), 0);
}

function items(n: XmlNode): DraftItem[] {
  const out: DraftItem[] = [];
  for (const s of selections(n)) {
    if (type(s) === 'model') continue;
    out.push({ name: str(s['name']), count: num(s) });
    out.push(...items(s));
  }
  return out;
}

function models(n: XmlNode): DraftModel[] {
  const out: DraftModel[] = [];
  for (const s of selections(n)) {
    if (type(s) === 'model') out.push({ name: str(s['name']), count: num(s), items: items(s) });
    else out.push(...models(s));
  }
  return out;
}

function unitFrom(n: XmlNode, where: string): DraftUnit {
  const isModel = type(n) === 'model';
  const draftModels = isModel
    ? [{ name: str(n['name']), count: num(n), items: items(n) }]
    : models(n);
  const points = totalPts(n);
  return {
    name: str(n['name']),
    ...(points > 0 ? { points } : {}),
    models: draftModels,
    items: isModel ? [] : items(n),
    source: where,
  };
}

export function parseRos(xml: string): RosterDraft {
  const warnings: string[] = [];
  let doc: XmlNode;
  try {
    doc = parser.parse(xml) as XmlNode;
  } catch (e) {
    return {
      format: 'ros',
      factionHints: [],
      detachmentHints: [],
      units: [],
      warnings: [`Not valid XML: ${(e as Error).message}`],
    };
  }
  const roster = doc['roster'] as XmlNode | undefined;
  if (!roster)
    return {
      format: 'ros',
      factionHints: [],
      detachmentHints: [],
      units: [],
      warnings: ['No <roster> element found'],
    };

  const factionHints: string[] = [];
  const detachmentHints: string[] = [];
  const units: DraftUnit[] = [];
  const forces = arr((roster['forces'] as XmlNode | undefined)?.['force']);
  forces.forEach((force, fi) => {
    factionHints.push(str(force['catalogueName']), str(force['name']));
    selections(force).forEach((s, si) => {
      const t = type(s);
      if (t === 'unit' || t === 'model')
        units.push(unitFrom(s, `force ${fi + 1}, selection ${si + 1}`));
      else {
        // Configuration entries (battle size, detachment choice...): keep names as hints.
        detachmentHints.push(str(s['name']), ...items(s).map((i) => i.name));
      }
    });
  });
  if (units.length === 0) warnings.push('The roster contains no units');
  const rosterPts = pts(roster);
  return {
    format: 'ros',
    name: str(roster['name']) || 'Imported roster',
    ...(rosterPts > 0 ? { points: rosterPts } : {}),
    factionHints: factionHints.filter(Boolean),
    detachmentHints: detachmentHints.filter(Boolean),
    units,
    warnings,
  };
}

export function parseRosz(bytes: Uint8Array): RosterDraft {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (e) {
    return {
      format: 'rosz',
      factionHints: [],
      detachmentHints: [],
      units: [],
      warnings: [`Not a valid .rosz archive: ${(e as Error).message}`],
    };
  }
  const entry =
    Object.keys(files).find((n) => n.toLowerCase().endsWith('.ros')) ?? Object.keys(files)[0];
  if (!entry)
    return {
      format: 'rosz',
      factionHints: [],
      detachmentHints: [],
      units: [],
      warnings: ['Empty .rosz archive'],
    };
  const draft = parseRos(new TextDecoder().decode(files[entry]));
  return { ...draft, format: 'rosz' };
}
