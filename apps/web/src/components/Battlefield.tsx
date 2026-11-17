import {
  type GameState,
  type ModelState,
  type Point,
  type UnitState,
  aliveModels,
  centroid,
  dist,
  isObscuring,
} from '@battle-drill/engine';
import { type PointerEvent, useMemo, useRef, useState } from 'react';
import { PieceDefs, pieceType } from '../art/pieces.js';
import { useGame } from '../game/store.js';

const TERRAIN_FILL: Record<string, string> = {
  dense: 'var(--terrain-dense)',
  light: 'var(--terrain-light)',
  exposed: 'var(--terrain-exposed)',
};

interface Props {
  state: GameState;
  /** Max distance a drag may move the selected unit (null = dragging disabled). */
  dragLimit: number | null;
  /** Range rings to draw around the selected unit's models (inches). */
  rings: readonly { radius: number; label: string }[];
  onUnitClick: (unitId: string) => void;
  onBackgroundClick?: () => void;
  /** Enter on the selected unit with a pending move. */
  onConfirm?: () => void;
  highlightUnitIds?: readonly string[];
}

function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Name plate above (your units) or below (enemy units) a unit: "Name 9/10". */
function UnitPlate({ unit }: { unit: UnitState }) {
  const ms = aliveModels(unit).filter((m) => m.position);
  if (ms.length === 0) return null;
  const cx = ms.reduce((n, m) => n + m.position!.x, 0) / ms.length;
  const below = unit.player === 'p1';
  const y = below
    ? Math.max(...ms.map((m) => m.position!.y + m.baseRadius)) + 0.25
    : Math.min(...ms.map((m) => m.position!.y - m.baseRadius)) - 1.1;
  const label = `${unit.name} ${ms.length}/${unit.startingStrength}`;
  const w = label.length * 0.37 + 0.8;
  return (
    <g className={`unit-plate plate-${unit.player}`} aria-hidden="true">
      <rect x={cx - w / 2} y={y} width={w} height={0.9} />
      <text x={cx} y={y + 0.66}>
        {label}
      </text>
    </g>
  );
}

export function Battlefield({
  state,
  dragLimit,
  rings,
  onUnitClick,
  onBackgroundClick,
  onConfirm,
  highlightUnitIds = [],
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { selectedUnitId, pending, setPending } = useGame();
  const [drag, setDrag] = useState<{ start: Point; delta: Point } | null>(null);
  // A drag ends with a click on the same unit; that click must not toggle the selection.
  const justDragged = useRef(false);
  const { width, height, terrain, objectives, deploymentZones } = state.battlefield;
  const selected = selectedUnitId ? state.units[selectedUnitId] : undefined;

  const units = Object.values(state.units);
  const ghost = useMemo(() => {
    if (!selected) return null;
    if (drag)
      return aliveModels(selected).map((m) => ({
        ...m,
        position: { x: m.position!.x + drag.delta.x, y: m.position!.y + drag.delta.y },
      }));
    if (pending && pending.unitId === selected.id)
      return aliveModels(selected).map((m, i) => ({ ...m, position: pending.positions[i]! }));
    return null;
  }, [selected, drag, pending]);

  const onPointerDown = (e: PointerEvent<SVGGElement>, unit: UnitState) => {
    if (unit.id !== selectedUnitId || dragLimit === null || !svgRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ start: svgPoint(svgRef.current, e), delta: { x: 0, y: 0 } });
  };
  const onPointerMove = (e: PointerEvent<SVGGElement>) => {
    if (!drag || !svgRef.current || dragLimit === null) return;
    const p = svgPoint(svgRef.current, e);
    let d = { x: p.x - drag.start.x, y: p.y - drag.start.y };
    const len = Math.hypot(d.x, d.y);
    if (len > dragLimit) d = { x: (d.x * dragLimit) / len, y: (d.y * dragLimit) / len };
    setDrag({ ...drag, delta: d });
  };
  const onPointerUp = () => {
    if (!drag || !selected) return;
    if (Math.hypot(drag.delta.x, drag.delta.y) > 0.05) {
      justDragged.current = true;
      setPending({
        unitId: selected.id,
        positions: aliveModels(selected).map((m) => ({
          x: m.position!.x + drag.delta.x,
          y: m.position!.y + drag.delta.y,
        })),
      });
    }
    setDrag(null);
  };

  const ruler = (() => {
    if (!selected || !ghost) return null;
    const from = centroid(aliveModels(selected).map((m) => m.position!));
    const to = centroid(ghost.map((m) => m.position!));
    return { from, to, d: dist(from, to) };
  })();

  return (
    <svg
      ref={svgRef}
      className="battlefield"
      viewBox={`-0.5 -0.5 ${width + 1} ${height + 1}`}
      role="group"
      aria-label={`Battlefield ${width} by ${height} inches`}
      data-tutorial-id="battlefield"
      data-testid="battlefield"
    >
      <defs>
        <pattern
          id="hatch"
          width="1"
          height="1"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="1" stroke="var(--terrain-line)" strokeWidth="0.15" />
        </pattern>
        <filter id="board-texture" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.18 0.26" numOctaves="4" seed="11" />
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.22  0 0 0 0 0.16  0 0 0 0.28 0" />
        </filter>
        <filter id="piece-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.08" dy="0.16" stdDeviation="0.1" floodOpacity="0.55" />
        </filter>
        <PieceDefs />
      </defs>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        className="board"
        onClick={onBackgroundClick}
      />
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        filter="url(#board-texture)"
        className="board-texture"
      />
      {deploymentZones.map((z) => (
        <polygon
          key={z.player}
          points={z.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
          className={`zone zone-${z.player}`}
        />
      ))}
      {deploymentZones.map((z) => {
        const ys = z.polygon.map((p) => p.y);
        const top = Math.min(...ys) < height / 2;
        return (
          <text
            key={`label-${z.player}`}
            x={width - 0.4}
            y={top ? Math.max(...ys) + 0.9 : Math.min(...ys) - 0.4}
            className={`zone-label zone-label-${z.player}`}
          >
            {z.player === 'p1' ? 'YOUR DEPLOYMENT ZONE' : 'ENEMY DEPLOYMENT ZONE'}
          </text>
        );
      })}
      {terrain.map((t) => (
        <g key={t.id} data-tutorial-id={`terrain-${t.id}`}>
          <polygon
            points={t.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={TERRAIN_FILL[t.categories[0] ?? 'exposed']}
            className="terrain"
          />
          {isObscuring(t) && (
            <polygon points={t.polygon.map((p) => `${p.x},${p.y}`).join(' ')} fill="url(#hatch)" />
          )}
          <rect
            x={Math.min(...t.polygon.map((p) => p.x))}
            y={Math.min(...t.polygon.map((p) => p.y)) - 1.05}
            width={(t.name.length + t.categories[0]!.length + 3) * 0.36 + 0.6}
            height={0.95}
            className="terrain-plate"
          />
          <text
            x={Math.min(...t.polygon.map((p) => p.x)) + 0.3}
            y={Math.min(...t.polygon.map((p) => p.y)) - 0.3}
            className="terrain-label"
          >
            {`${t.name} \u00b7 ${t.categories[0] ?? ''}`.toUpperCase()}
          </text>
        </g>
      ))}
      {objectives.map((o, index) => {
        const owner = state.objectiveControl[o.id];
        return (
          <g key={o.id} data-tutorial-id={`objective-${o.id}`}>
            {!o.terrainAreaId && (
              <circle
                cx={o.position.x}
                cy={o.position.y}
                r={3 + 0.79}
                className="objective-range"
              />
            )}
            <circle
              cx={o.position.x}
              cy={o.position.y}
              r={0.79}
              className={`objective ${owner ? `objective-${owner}` : ''}`}
              filter="url(#piece-shadow)"
            />
            <text
              x={o.position.x}
              y={o.position.y + 0.33}
              className={`objective-number ${owner ? 'held' : ''}`}
            >
              {index + 1}
            </text>
          </g>
        );
      })}

      {selected &&
        rings.map((ring) =>
          aliveModels(selected).map((m) => (
            <circle
              key={`${ring.label}-${m.id}`}
              cx={m.position!.x}
              cy={m.position!.y}
              r={ring.radius + m.baseRadius}
              className="range-ring"
            />
          )),
        )}

      {units.map((u) => {
        const ms = aliveModels(u).filter((m) => m.position);
        if (ms.length === 0) return null;
        const isSel = u.id === selectedUnitId;
        const isHi = highlightUnitIds.includes(u.id);
        return (
          <g
            key={u.id}
            className={`unit unit-${u.player} ${isSel ? 'selected' : ''} ${isHi ? 'highlight' : ''} ${dragLimit !== null && isSel ? 'draggable' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${u.name} ${ms.length}/${u.startingStrength}, ${u.player === 'p1' ? 'your unit' : 'enemy unit'}`}
            aria-pressed={isSel}
            data-tutorial-id={`unit-${u.id}`}
            data-testid={`unit-${u.id}`}
            onClick={() => {
              if (justDragged.current) {
                justDragged.current = false;
                return;
              }
              onUnitClick(u.id);
            }}
            onKeyDown={(e) => {
              // Keyboard moves: arrows nudge the selected unit 1" (within the move's limit),
              // Enter confirms, Escape cancels.
              const arrows: Record<string, Point> = {
                ArrowUp: { x: 0, y: -1 },
                ArrowDown: { x: 0, y: 1 },
                ArrowLeft: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 },
              };
              const step = arrows[e.key];
              if (step && isSel && dragLimit !== null) {
                e.preventDefault();
                const base = aliveModels(u);
                const current =
                  pending && pending.unitId === u.id
                    ? pending.positions
                    : base.map((m) => m.position!);
                const offset = {
                  x: current[0]!.x - base[0]!.position!.x + step.x,
                  y: current[0]!.y - base[0]!.position!.y + step.y,
                };
                const len = Math.hypot(offset.x, offset.y);
                const k = len > dragLimit ? dragLimit / len : 1;
                setPending({
                  unitId: u.id,
                  positions: base.map((m) => ({
                    x: m.position!.x + offset.x * k,
                    y: m.position!.y + offset.y * k,
                  })),
                });
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                if (pending) setPending(null);
                else onBackgroundClick?.();
                return;
              }
              if (e.key === 'Enter' && isSel && pending && pending.unitId === u.id && onConfirm) {
                e.preventDefault();
                onConfirm();
                return;
              }
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onUnitClick(u.id);
              }
            }}
            onPointerDown={(e) => onPointerDown(e, u)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {ms.map((m: ModelState) => {
              const r = m.baseRadius;
              const art = r * 1.7;
              return (
                <g key={m.id} className={`piece side-${u.player}`} filter="url(#piece-shadow)">
                  <circle
                    cx={m.position!.x}
                    cy={m.position!.y}
                    r={r}
                    className={m.woundsLeft < m.wounds ? 'model wounded' : 'model'}
                  >
                    <title>{`${m.name}: ${m.woundsLeft}/${m.wounds} W`}</title>
                  </circle>
                  <use
                    href={`#piece-${pieceType(u.keywords, u.datasheetId)}`}
                    x={m.position!.x - art / 2}
                    y={m.position!.y - art / 2 - r * 0.04}
                    width={art}
                    height={art}
                    className="piece-figure"
                  />
                </g>
              );
            })}
            <UnitPlate unit={u} />
          </g>
        );
      })}

      {ghost &&
        ghost.map((m) => (
          <circle
            key={`g-${m.id}`}
            cx={m.position!.x}
            cy={m.position!.y}
            r={m.baseRadius}
            className="ghost"
          />
        ))}
      {ruler && ruler.d > 0.05 && (
        <g className="ruler" data-testid="ruler">
          <line x1={ruler.from.x} y1={ruler.from.y} x2={ruler.to.x} y2={ruler.to.y} />
          <text x={(ruler.from.x + ruler.to.x) / 2 + 0.4} y={(ruler.from.y + ruler.to.y) / 2}>
            {ruler.d.toFixed(1)}&quot;
          </text>
        </g>
      )}
    </svg>
  );
}
