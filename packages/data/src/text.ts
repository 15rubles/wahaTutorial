/** Byte order mark. Built from a char code so formatters cannot turn it into an invisible literal. */
export const BOM = String.fromCharCode(0xfeff);

export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(BOM.length) : text;
}
