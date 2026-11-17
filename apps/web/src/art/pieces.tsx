/**
 * Placeholder game pieces: one simple, invented silhouette per unit TYPE, picked from a unit's
 * keywords, so every faction gets pieces without per-model art. Colours come from CSS variables
 * (--pm main, --pd dark, --pe eye) so one symbol serves both sides.
 */
import type { ReactNode } from 'react';

export type PieceType =
  | 'infantry'
  | 'character'
  | 'mounted'
  | 'walker'
  | 'vehicle'
  | 'monster'
  | 'beast'
  | 'swarm'
  | 'aircraft'
  | 'fortification'
  | 'dummy';

export const PIECE_LABEL: Record<PieceType, string> = {
  infantry: 'Infantry',
  character: 'Character',
  mounted: 'Mounted',
  walker: 'Walker',
  vehicle: 'Vehicle',
  monster: 'Monster',
  beast: 'Beast',
  swarm: 'Swarm',
  aircraft: 'Aircraft',
  fortification: 'Fortification',
  dummy: 'Practice target',
};

const DUMMY_IDS = new Set(['practice-dummies', 'stand-in-target']);

/** Picks the piece for a unit from its keywords (upper case). */
export function pieceType(keywords: readonly string[], datasheetId = ''): PieceType {
  if (DUMMY_IDS.has(datasheetId)) return 'dummy';
  const has = (...k: string[]) => k.some((x) => keywords.includes(x));
  if (has('FORTIFICATION', 'BUILDING')) return 'fortification';
  if (has('AIRCRAFT')) return 'aircraft';
  if (has('WALKER')) return 'walker';
  if (has('VEHICLE')) return has('FLY') && !has('TRANSPORT') ? 'aircraft' : 'vehicle';
  if (has('MONSTER')) return 'monster';
  if (has('MOUNTED', 'CAVALRY', 'BIKE', 'BIKER')) return 'mounted';
  if (has('SWARM')) return 'swarm';
  if (has('BEAST', 'BEASTS')) return 'beast';
  if (has('CHARACTER')) return 'character';
  return 'infantry';
}

const M = 'var(--pm)';
const D = 'var(--pd)';
const E = 'var(--pe)';
const STEEL = '#3b3b3b';

const SHAPES: Record<PieceType, ReactNode> = {
  infantry: (
    <>
      <path d="M38 88 l4-26 h16 l4 26 h-8 l-4-18 -4 18z" fill={D} />
      <path d="M33 36 q17-10 34 0 l3 28 h-40z" fill={M} stroke={D} strokeWidth="3" />
      <circle cx="50" cy="26" r="10" fill={M} stroke={D} strokeWidth="3" />
      <rect x="43" y="23" width="14" height="4" fill={E} />
      <path d="M58 44 l26-6 2 6 -26 8z" fill={STEEL} />
      <path d="M30 40 l-6 18 6 2 6-14z" fill={M} stroke={D} strokeWidth="2" />
    </>
  ),
  character: (
    <>
      <path d="M28 88 q22-60 44 0z" fill={D} />
      <path d="M32 34 q18-12 36 0 l2 32 h-40z" fill={M} stroke={D} strokeWidth="3" />
      <circle cx="50" cy="24" r="10" fill={M} stroke={D} strokeWidth="3" />
      <rect x="43" y="21" width="14" height="4" fill={E} />
      <path d="M43 11 l7-7 7 7z" fill="#d9b84a" />
      <path d="M71 16 h5 v56 h-5z" fill="#c9c2b0" stroke={STEEL} />
      <path d="M65 16 h17 l-8-11z" fill="#d9b84a" />
    </>
  ),
  mounted: (
    <>
      <path
        d="M16 58 q8-14 32-12 h26 q12 2 14 14 l-2 6 -8-4 -4 26 h-7 l-2-20 h-22 l-4 20 h-7 v-24 l-8 6z"
        fill={D}
      />
      <path d="M74 48 l12-12 6 4 -4 12z" fill={D} />
      <path d="M42 22 q8-6 16 0 l2 26 h-20z" fill={M} stroke={D} strokeWidth="2" />
      <circle cx="50" cy="16" r="8" fill={M} stroke={D} strokeWidth="2" />
      <rect x="45" y="13" width="10" height="3" fill={E} />
      <path d="M56 30 l40-14 1 4 -40 14z" fill="#c9c2b0" stroke={STEEL} />
    </>
  ),
  walker: (
    <>
      <path d="M32 90 l6-26 h8 l-4 26z M68 90 l-6-26 h-8 l4 26z" fill={D} />
      <rect x="26" y="26" width="48" height="40" rx="6" fill={M} stroke={D} strokeWidth="3" />
      <rect x="38" y="34" width="24" height="8" fill={E} />
      <rect x="6" y="34" width="20" height="12" fill={STEEL} />
      <path d="M74 36 h14 l6 10 -6 10 h-14z" fill={STEEL} />
      <rect x="34" y="16" width="32" height="10" fill={D} />
    </>
  ),
  vehicle: (
    <>
      <rect x="10" y="58" width="80" height="22" rx="10" fill={D} />
      <circle cx="24" cy="69" r="6" fill={STEEL} />
      <circle cx="42" cy="69" r="6" fill={STEEL} />
      <circle cx="58" cy="69" r="6" fill={STEEL} />
      <circle cx="76" cy="69" r="6" fill={STEEL} />
      <path d="M16 58 l8-20 h52 l8 20z" fill={M} stroke={D} strokeWidth="3" />
      <rect x="36" y="26" width="28" height="14" rx="3" fill={M} stroke={D} strokeWidth="3" />
      <rect x="62" y="29" width="32" height="7" fill={STEEL} />
      <rect x="40" y="30" width="10" height="4" fill={E} />
    </>
  ),
  monster: (
    <>
      <path d="M22 90 l8-24 h10 l-4 24z M78 90 l-8-24 h-10 l4 24z" fill={D} />
      <path d="M20 60 q0-34 30-36 q30 2 30 36 q-30 12 -60 0z" fill={M} stroke={D} strokeWidth="3" />
      <path d="M36 26 l-10-16 16 10z M64 26 l10-16 -16 10z" fill="#c9c2b0" stroke={STEEL} />
      <path d="M38 40 l8 4 M62 40 l-8 4" stroke={E} strokeWidth="4" />
      <path d="M40 54 l4 6 4-6 4 6 4-6 4 6" fill="none" stroke="#f3eee2" strokeWidth="3" />
      <path d="M20 58 l-12 10 6 4 12-8z M80 58 l12 10 -6 4 -12-8z" fill={D} />
    </>
  ),
  beast: (
    <>
      <path
        d="M20 62 q10-16 40-14 q20 2 22 16 l-4 4 -2 20 h-7 l-2-14 h-26 l-4 14 h-7 l2-20z"
        fill={M}
        stroke={D}
        strokeWidth="3"
      />
      <path d="M70 48 l14-14 10 6 -6 14z" fill={M} stroke={D} strokeWidth="3" />
      <circle cx="86" cy="42" r="2.5" fill={E} />
      <path d="M20 62 l-12-6" stroke={D} strokeWidth="4" />
    </>
  ),
  swarm: (
    <>
      {[
        [30, 40],
        [56, 32],
        [72, 54],
        [40, 64],
        [62, 74],
        [24, 70],
      ].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="11" ry="8" fill={M} stroke={D} strokeWidth="2.5" />
          <circle cx={x! + 6} cy={y! - 2} r="1.8" fill={E} />
        </g>
      ))}
    </>
  ),
  aircraft: (
    <>
      <path
        d="M50 8 l8 22 v14 l34 16 v8 l-34-8 -2 18 10 8 v6 l-16-4 -16 4 v-6 l10-8 -2-18 -34 8 v-8 l34-16 v-14z"
        fill={M}
        stroke={D}
        strokeWidth="3"
      />
      <rect x="46" y="22" width="8" height="10" rx="3" fill={E} />
    </>
  ),
  fortification: (
    <>
      <path d="M14 86 v-46 l10-8 h52 l10 8 v46z" fill={M} stroke={D} strokeWidth="3" />
      <rect x="22" y="48" width="56" height="8" fill={D} />
      <rect x="40" y="64" width="20" height="22" fill={D} />
      <path
        d="M24 32 v-10 h10 v10 M45 32 v-10 h10 v10 M66 32 v-10 h10 v10"
        fill={M}
        stroke={D}
        strokeWidth="3"
      />
    </>
  ),
  dummy: (
    <>
      <rect x="47" y="40" width="6" height="50" fill="#6b5233" />
      <rect x="24" y="44" width="52" height="6" fill="#6b5233" />
      <ellipse cx="50" cy="52" rx="16" ry="20" fill={M} stroke={D} strokeWidth="2" />
      <circle cx="50" cy="24" r="10" fill={M} stroke={D} strokeWidth="2" />
      <circle cx="50" cy="52" r="8" fill="none" stroke={D} strokeWidth="2" />
      <circle cx="50" cy="52" r="2.5" fill={D} />
    </>
  ),
};

export const PIECE_TYPES = Object.keys(SHAPES) as PieceType[];

/** `<symbol>` definitions; render once inside an SVG's `<defs>`. */
export function PieceDefs() {
  return (
    <>
      {PIECE_TYPES.map((t) => (
        <symbol key={t} id={`piece-${t}`} viewBox="0 0 100 100">
          {SHAPES[t]}
        </symbol>
      ))}
    </>
  );
}

/** Standalone piece picture (cards, legends). `side` sets the colours. */
export function PieceArt({
  type,
  side,
  size = 96,
  title,
}: {
  type: PieceType;
  side: 'p1' | 'p2';
  size?: number;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`piece-art side-${side}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <ellipse cx="50" cy="93" rx="30" ry="5" fill="#0004" />
      {SHAPES[type]}
    </svg>
  );
}
