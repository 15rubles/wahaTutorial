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
import { useGame } from '../game/store.js';

export const PLAYER_COLOR = { p1: 'var(--p1)', p2: 'var(--p2)' } as const;

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
  highlightUnitIds?: readonly string[];
}

function svgPoint(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

export function Battlefield({
  state,
  dragLimit,
  rings,
  onUnitClick,
  onBackgroundClick,
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
      role="img"
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
      </defs>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        className="board"
        onClick={onBackgroundClick}
      />
      {deploymentZones.map((z) => (
        <polygon
          key={z.player}
          points={z.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
          className={`zone zone-${z.player}`}
        />
      ))}
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
          <text x={t.polygon[0]!.x + 0.3} y={t.polygon[0]!.y + 0.9} className="terrain-label">
            {t.name}
          </text>
        </g>
      ))}
      {objectives.map((o) => {
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
            />
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
            aria-label={`${u.player === 'p1' ? 'Your' : 'Enemy'} unit ${u.name}, ${ms.length} models`}
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
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onUnitClick(u.id);
              }
            }}
            onPointerDown={(e) => onPointerDown(e, u)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {ms.map((m: ModelState) => (
              <circle
                key={m.id}
                cx={m.position!.x}
                cy={m.position!.y}
                r={m.baseRadius}
                fill={PLAYER_COLOR[u.player]}
                className={m.woundsLeft < m.wounds ? 'model wounded' : 'model'}
              >
                <title>{`${m.name}: ${m.woundsLeft}/${m.wounds} W`}</title>
              </circle>
            ))}
            {ms.some((m) => m.isCharacter) && ms.length === 1 && (
              <text x={ms[0]!.position!.x} y={ms[0]!.position!.y + 0.25} className="model-mark">
                *
              </text>
            )}
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
