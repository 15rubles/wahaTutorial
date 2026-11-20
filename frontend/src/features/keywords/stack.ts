/** Popup stack rules (DESIGN.md 8): depth limit 10, no duplicate consecutive entries. */
export type PopupEntry = { id: string | undefined; label: string };

export const MAX_DEPTH = 10;

export function push(stack: PopupEntry[], entry: PopupEntry): PopupEntry[] {
  const top = stack[stack.length - 1];
  if (top && sameEntry(top, entry)) return stack;
  const next = [...stack, entry];
  return next.length > MAX_DEPTH ? next.slice(next.length - MAX_DEPTH) : next;
}

export function pop(stack: PopupEntry[]): PopupEntry[] {
  return stack.slice(0, -1);
}

/** Jump back to a breadcrumb position (inclusive). */
export function truncate(stack: PopupEntry[], index: number): PopupEntry[] {
  return stack.slice(0, Math.max(0, index + 1));
}

function sameEntry(a: PopupEntry, b: PopupEntry): boolean {
  return a.id !== undefined ? a.id === b.id : a.label.toLowerCase() === b.label.toLowerCase();
}
