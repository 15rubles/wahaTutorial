import type { GameState } from '../game/state.js';
import { aliveModels } from '../types.js';
import { canDeclareCharge, possibleChargeTargets } from './charge.js';
import { canConsolidate, canPileIn, eligibleToFight } from './fight.js';
import { eligibleMoveTypes } from './movement.js';
import { eligibleShootingTypes } from './shooting.js';

export const ruleRefs = ['core.the-battle-round.player-turns'];

/** Machine readable options for "What can I do now?". The UI words them. */
export type LegalOption =
  | { readonly kind: 'move'; readonly moveTypes: readonly string[] }
  | { readonly kind: 'in-reserves'; readonly canArrive: boolean }
  | { readonly kind: 'shoot'; readonly shootingTypes: readonly string[] }
  | { readonly kind: 'declare-charge' }
  | { readonly kind: 'charge-move'; readonly targets: readonly string[] }
  | { readonly kind: 'pile-in' }
  | { readonly kind: 'fight' }
  | { readonly kind: 'consolidate' }
  | {
      readonly kind: 'none';
      readonly reason: 'destroyed' | 'not-your-turn' | 'already-acted' | 'nothing-this-phase';
    };

export function legalActions(state: GameState, unitId: string): LegalOption[] {
  const unit = state.units[unitId];
  const st = state.status[unitId];
  if (!unit || !st || aliveModels(unit).length === 0)
    return [{ kind: 'none', reason: 'destroyed' }];
  const out: LegalOption[] = [];
  const active = unit.player === state.activePlayer;
  if (st.inReserves)
    return [
      {
        kind: 'in-reserves',
        canArrive:
          active &&
          state.phase === 'movement' &&
          eligibleMoveTypes(state, unitId).includes('ingress'),
      },
    ];
  switch (state.phase) {
    case 'movement': {
      const types = active ? eligibleMoveTypes(state, unitId) : [];
      if (types.length > 0) out.push({ kind: 'move', moveTypes: types });
      else if (active) return [{ kind: 'none', reason: 'already-acted' }];
      break;
    }
    case 'shooting': {
      const types = active ? eligibleShootingTypes(state, unitId) : [];
      if (types.length > 0) out.push({ kind: 'shoot', shootingTypes: types });
      break;
    }
    case 'charge':
      if (!active) break;
      if (st.declaredCharge && !st.charged && st.chargeRoll !== null)
        out.push({
          kind: 'charge-move',
          targets: possibleChargeTargets(state, unitId).map((u) => u.id),
        });
      else if (!canDeclareCharge(state, unitId)) out.push({ kind: 'declare-charge' });
      break;
    case 'fight':
      if (state.fightStep === 'pile-in' && canPileIn(state, unitId)) out.push({ kind: 'pile-in' });
      if (state.fightStep === 'fight' && eligibleToFight(state, unitId))
        out.push({ kind: 'fight' });
      if (state.fightStep === 'consolidate' && canConsolidate(state, unitId))
        out.push({ kind: 'consolidate' });
      break;
    default:
      break;
  }
  if (out.length > 0) return out;
  if (!active && state.phase !== 'fight') return [{ kind: 'none', reason: 'not-your-turn' }];
  return [{ kind: 'none', reason: 'nothing-this-phase' }];
}
