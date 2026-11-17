/**
 * Best-effort parser for plain text roster exports (official app style and New Recruit styles).
 * Tolerant by design: lines it cannot understand are skipped, never fatal.
 *
 * Recognised unit lines (points in () or []):
 *   `Name (80 points)`  `Name [80pts]: item, item`  `Char1: 1x Name (80 pts): items`  `2x Name (40 pts)`
 * Recognised detail lines (bullets or indentation): `1x Model`, `2x Weapon`, `Warlord`,
 *   `Enhancement: Name`.
 */
import type { DraftItem, DraftModel, DraftUnit, RosterDraft } from './types.js';

const UNIT_LINE =
  /^(?:[A-Za-z]{2,5}\d+\s*:\s*)?(?:(\d+)\s*x\s+)?(.+?)\s*[([]\s*(\d+)\s*(?:points?|pts?)\s*[)\]]\s*(?::\s*(.*))?$/i;
const BULLET = /^(\s*)(?:[•◦▪‣*+-]|\d+\.)\s+/;
const COUNTED = /^(\d+)\s*x\s+(.+)$/i;
/** Battle size names appear as `Name (1000 points)` lines in some exports; they are not units. */
const BATTLE_SIZE = /^(combat patrol|incursion|strike force|onslaught)\b/i;
const HEADER_KEY =
  /^\+?\s*(faction(?:\s+keyword)?|detachment(?:\s+rule)?|army|configuration)\s*:\s*(.+)$/i;

interface Line {
  indent: number;
  bullet: boolean;
  text: string;
  no: number;
}

function lines(input: string): Line[] {
  return input.split(/\r?\n/).map((raw, i) => {
    const expanded = raw.replace(/\t/g, '  ');
    const m = BULLET.exec(expanded);
    const indent = (m ? m[1]!.length : (/^\s*/.exec(expanded)?.[0].length ?? 0)) + (m ? 1 : 0);
    const text = (m ? expanded.slice(m[0].length) : expanded).trim().replace(/\s+/g, ' ');
    return { indent, bullet: !!m, text, no: i + 1 };
  });
}

function splitList(s: string): DraftItem[] {
  return s
    .split(/,|;/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = COUNTED.exec(p);
      return m ? { name: m[2]!.trim(), count: Number(m[1]) } : { name: p, count: 1 };
    });
}

export function parseRosterText(input: string): RosterDraft {
  const all = lines(input);
  const factionHints: string[] = [];
  const detachmentHints: string[] = [];
  const units: DraftUnit[] = [];
  const warnings: string[] = [];
  let name: string | undefined;
  let points: number | undefined;

  let current:
    | {
        unit: Omit<DraftUnit, 'models' | 'items'>;
        models: DraftModel[];
        items: DraftItem[];
        indent: number;
      }
    | undefined;
  let currentModel: { model: DraftModel; indent: number } | undefined;
  const flush = () => {
    if (current) units.push({ ...current.unit, models: current.models, items: current.items });
    current = undefined;
    currentModel = undefined;
  };

  let first = true;
  for (const line of all) {
    if (!line.text || /^[+=-]{3,}$/.test(line.text) || /^exported with/i.test(line.text)) continue;
    const isFirst = first;
    first = false;

    const header = HEADER_KEY.exec(line.text);
    if (header && !line.bullet) {
      const key = header[1]!.toLowerCase();
      const value = header[2]!.replace(/\s*[([].*$/, '').trim();
      if (key.startsWith('faction')) factionHints.push(value);
      else if (key.startsWith('detachment')) detachmentHints.push(value);
      else if (key === 'configuration')
        detachmentHints.push(...value.split(/[;,]/).map((v) => v.replace(/^[^:]*:\s*/, '').trim()));
      continue;
    }

    // `Enhancement: Name` belongs to the unit above it, even without a bullet or indent.
    const enhancementLine = /^enhancements?\s*:\s*(.+)$/i.exec(line.text);
    if (enhancementLine && current) {
      current.items.push({
        name: `Enhancement: ${enhancementLine[1]!.replace(/\s*[([].*$/, '').trim()}`,
        count: 1,
      });
      continue;
    }

    const unit = !line.bullet ? UNIT_LINE.exec(line.text) : null;
    // The first line of an export with a points total is the army name, not a unit.
    if (unit && isFirst && !unit[1] && !unit[4]) {
      name = unit[2]!.trim();
      points = Number(unit[3]);
      continue;
    }
    if (unit && line.indent <= 2 && BATTLE_SIZE.test(unit[2]!.trim()) && !current) {
      detachmentHints.push(unit[2]!.trim());
      continue;
    }
    if (unit && line.indent <= 2) {
      // The first points line with no unit details after it is usually the army total; decided later.
      flush();
      const copies = unit[1] ? Number(unit[1]) : undefined;
      current = {
        unit: {
          name: unit[2]!.trim(),
          points: Number(unit[3]),
          ...(copies ? { copies } : {}),
          source: `line ${line.no}`,
        },
        models: [],
        items: unit[4] ? splitList(unit[4]) : [],
        indent: line.indent,
      };
      continue;
    }

    if (current && (line.bullet || line.indent > current.indent)) {
      const enh = /^enhancements?\s*:\s*(.+)$/i.exec(line.text);
      if (enh) {
        current.items.push({
          name: `Enhancement: ${enh[1]!.replace(/\s*[([].*$/, '').trim()}`,
          count: 1,
        });
        continue;
      }
      const counted = COUNTED.exec(line.text);
      if (counted) {
        const item = {
          name: counted[2]!.replace(/\s*[([].*$/, '').trim(),
          count: Number(counted[1]),
        };
        if (currentModel && line.indent > currentModel.indent) {
          (currentModel.model.items as DraftItem[]).push(item);
        } else {
          // A counted line becomes a model when deeper lines follow it; until then treat it as both.
          currentModel = {
            model: { name: item.name, count: item.count, items: [] },
            indent: line.indent,
          };
          current.models.push(currentModel.model);
        }
        continue;
      }
      const item = { name: line.text.replace(/\s*[([].*$/, '').trim(), count: 1 };
      if (currentModel && line.indent > currentModel.indent)
        (currentModel.model.items as DraftItem[]).push(item);
      else current.items.push(item);
      continue;
    }

    // Non indented line without points: a section header, faction or detachment name, or army name.
    flush();
    const total = /^(.*?)\s*[([]\s*(\d+)\s*(?:points?|pts?)\s*[)\]]\s*$/i.exec(line.text);
    if (total && !name) {
      name = total[1]!.replace(/[+]+/g, '').trim() || undefined;
      points = Number(total[2]);
      continue;
    }
    if (!name && units.length === 0 && !/^[A-Z\s&-]+$/.test(line.text)) name = line.text;
    factionHints.push(line.text);
    detachmentHints.push(line.text);
  }
  flush();

  // Counted lines without deeper lines may be wargear rather than models; resolve.ts decides
  // that with the datasheet's weapon names.
  const fixed = units;

  if (fixed.length === 0)
    warnings.push('No unit lines found. Expected lines like "Unit name (80 points)".');
  return {
    format: 'text',
    ...(name ? { name } : {}),
    ...(points !== undefined ? { points } : {}),
    factionHints,
    detachmentHints,
    units: fixed,
    warnings,
  };
}
