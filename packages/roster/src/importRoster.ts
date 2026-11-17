import { parseRos, parseRosz } from './ros.js';
import { parseRosterText } from './text.js';
import type { RosterDraft } from './types.js';

/** Byte order mark, built from a char code so formatters keep it visible. */
const BOM = String.fromCharCode(0xfeff);
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** Detects the format from the file name and content, then parses. Never throws. */
export function readRoster(fileName: string, content: Uint8Array | string): RosterDraft {
  try {
    if (typeof content !== 'string') {
      const isZip = ZIP_MAGIC.every((b, i) => content[i] === b);
      if (isZip || /\.rosz$/i.test(fileName)) return parseRosz(content);
      content = new TextDecoder().decode(content);
    }
    const text = content.startsWith(BOM) ? content.slice(1) : content;
    if (/\.ros$/i.test(fileName) || /^\s*<\?xml|^\s*<roster\b/.test(text)) return parseRos(text);
    return parseRosterText(text);
  } catch (e) {
    return {
      format: 'text',
      factionHints: [],
      detachmentHints: [],
      units: [],
      warnings: [`Could not read roster: ${(e as Error).message}`],
    };
  }
}
