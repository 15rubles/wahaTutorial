import { type RuleError, err } from '../game/errors.js';
import type { GameEvent, GameState } from '../game/state.js';
import type { PlayerId } from '../types.js';

export const ruleRefs = [
  'core.stratagems.using-stratagems',
  'core.command-phase.gain-core-cp.command-points',
];

/**
 * Spend CP on a stratagem (15.01). The engine checks the CP and the once-per-phase restrictions;
 * stratagem effects are shown as text and not simulated (decisions D-035).
 */
export function useStratagem(
  state: GameState,
  player: PlayerId,
  stratagemId: string,
  cost: number,
  targetUnitId: string | undefined,
): { state: GameState; events: GameEvent[] } | RuleError {
  if (!Number.isInteger(cost) || cost < 0) return err('NOT_ELIGIBLE', 'bad cost');
  const used = state.stratagemsThisPhase.filter((s) => s.player === player);
  if (used.some((s) => s.stratagemId === stratagemId)) return err('STRATAGEM_USED', stratagemId);
  if (targetUnitId) {
    const unit = state.units[targetUnitId];
    if (!unit) return err('UNKNOWN_UNIT', targetUnitId);
    if (unit.player === player && state.status[targetUnitId]?.battleShocked)
      return err('NOT_ELIGIBLE', 'battle-shocked units cannot be targeted');
    if (used.some((s) => s.unitId === targetUnitId))
      return err('STRATAGEM_USED', `${targetUnitId} already targeted`);
  }
  const cp = state.players[player].cp;
  if (cp < cost) return err('NOT_ENOUGH_CP', `${cp} < ${cost}`);
  const cpLeft = cp - cost;
  return {
    state: {
      ...state,
      players: { ...state.players, [player]: { ...state.players[player], cp: cpLeft } },
      stratagemsThisPhase: [
        ...state.stratagemsThisPhase,
        { player, stratagemId, unitId: targetUnitId ?? null },
      ],
    },
    events: [
      { type: 'StratagemUsed', player, stratagemId, unitId: targetUnitId ?? null, cost, cpLeft },
    ],
  };
}
