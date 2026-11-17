import { stripBom } from './text.js';

/**
 * Parser for the Wahapedia export format: `|` delimited, no quoting, a trailing `|` after the
 * last field of every record, UTF-8 with an optional BOM, LF or CRLF line endings.
 *
 * Description fields can contain raw newlines, so records are split by counting fields rather
 * than by splitting on lines: after the last field of a record comes a `|`, then a newline.
 */
export interface CsvRow {
  /** 1-based line number in the source file where the record starts. */
  readonly line: number;
  readonly values: Readonly<Record<string, string>>;
}

export interface CsvTable {
  readonly header: readonly string[];
  readonly rows: readonly CsvRow[];
  /** Records that could not be split into the right number of fields. */
  readonly malformed: readonly { line: number; reason: string }[];
}

export function parseCsv(input: string): CsvTable {
  const text = stripBom(input).replace(/\r\n/g, '\n');
  const firstBreak = text.indexOf('\n');
  const headerLine = firstBreak < 0 ? text : text.slice(0, firstBreak);
  const header = headerLine.split('|');
  if (header.at(-1) === '') header.pop();
  const width = header.length;
  const body = firstBreak < 0 ? '' : text.slice(firstBreak + 1);

  const rows: CsvRow[] = [];
  const malformed: { line: number; reason: string }[] = [];
  // The last token is whatever follows the final `|` (normally a newline or nothing).
  const tokens = body.split('|');
  const last = tokens.length - 1;
  let line = 2;
  let i = 0;

  while (i < last) {
    // Start of a record: the token begins with the newline(s) that ended the previous record.
    const first = tokens[i]!;
    const stripped = first.replace(/^\n+/, '');
    line += first.length - stripped.length;
    const recordLine = line;
    const fields = [stripped];
    line += countNewlines(stripped);
    i++;
    while (fields.length < width && i < last) {
      const tok = tokens[i]!;
      fields.push(tok);
      line += countNewlines(tok);
      i++;
    }
    if (fields.length < width) {
      malformed.push({ line: recordLine, reason: 'fewer fields than header' });
      break;
    }
    if (i < last && !tokens[i]!.startsWith('\n')) {
      // A field contained a `|`. Skip to the next token that starts a new line.
      malformed.push({ line: recordLine, reason: 'more fields than header' });
      while (i < last && !tokens[i]!.startsWith('\n')) {
        line += countNewlines(tokens[i]!);
        i++;
      }
      continue;
    }
    const values: Record<string, string> = {};
    header.forEach((name, idx) => {
      values[name] = fields[idx]!;
    });
    rows.push({ line: recordLine, values });
  }
  const tail = tokens[last] ?? '';
  if (last > 0 && tail.trim() !== '') malformed.push({ line, reason: 'unterminated record' });
  return { header, rows, malformed };
}

function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}
