import { pointInPolygon } from '../board/geometry.js';
import { type RuleError, err } from '../game/errors.js';
import { type GameEvent, type GameState, withStatus, withUnit } from '../game/state.js';
import { type Point, aliveModels } from '../types.js';
import { engagedEnemies, validateMove } from './validateMove.js';

export const ruleRefs = ['core.moving.set-up'];

/** Set up a unit wholly within its player's deployment zone, in coherency and unengaged (03.02). */
export function deploy(
  state: GameState,
  unitId: string,
  positions: readonly Point[],
): { state: GameState; events: GameEvent[] } | RuleError {
  const unit = state.units[unitId];
  if (!unit) return err('UNKNOWN_UNIT', unitId);
  if (aliveModels(unit).some((m) => m.position)) return err('ALREADY_ACTED', 'already deployed');
  if (state.status[unitId]?.inReserves) return err('ALREADY_ACTED', 'in reserves');
  const zone = state.battlefield.deploymentZones.find((z) => z.player === unit.player);
  const models = aliveModels(unit);
  if (zone) {
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]!;
      const r = models[i]?.baseRadius ?? 0;
      const corners = [
        p,
        { x: p.x + r, y: p.y },
        { x: p.x - r, y: p.y },
        { x: p.x, y: p.y + r },
        { x: p.x, y: p.y - r },
      ];
      if (!corners.every((c) => pointInPolygon(c, zone.polygon)))
        return err('OUTSIDE_DEPLOYMENT_ZONE', `model ${i + 1}`);
    }
  }
  const result = validateMove(state, unit, positions, { maxDistance: () => null });
  if ('code' in result) return result;
  let next = withUnit(state, result.unit);
  if (engagedEnemies(next, result.unit).length > 0) return err('ENDS_ENGAGED');
  next = withStatus(next, unitId, { setUpThisTurn: true });
  return { state: next, events: [{ type: 'UnitDeployed', unitId }] };
}
