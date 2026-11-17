/** Every mechanic file's ruleRefs, by file, so tools can check the ids exist in the local cache. */
import * as allocation from './attack/allocation.js';
import * as gatherDice from './attack/gatherDice.js';
import * as hazard from './attack/hazard.js';
import * as hitRoll from './attack/hitRoll.js';
import * as inflictDamage from './attack/inflictDamage.js';
import * as modifiers from './attack/modifiers.js';
import * as mortalWounds from './attack/mortalWounds.js';
import * as resolveAttacks from './attack/resolveAttacks.js';
import * as saveRoll from './attack/saveRoll.js';
import * as woundChart from './attack/woundChart.js';
import * as woundRoll from './attack/woundRoll.js';
import * as battlefield from './board/battlefield.js';
import * as coherency from './board/coherency.js';
import * as measure from './board/measure.js';
import * as visibility from './board/visibility.js';
import * as diceExpr from './dice/diceExpr.js';
import * as flow from './game/flow.js';
import * as state from './game/state.js';
import { implementedKeywords, keywordModule } from './keywords/registry.js';
import * as charge from './phases/charge.js';
import * as command from './phases/command.js';
import * as deployment from './phases/deployment.js';
import * as fight from './phases/fight.js';
import * as legal from './phases/legalActions.js';
import * as movement from './phases/movement.js';
import * as objectives from './phases/objectives.js';
import * as reserves from './phases/reserves.js';
import * as chargeProximity from './phases/chargeProximity.js';
import * as shooting from './phases/shooting.js';
import * as stratagems from './phases/stratagems.js';
import * as validateMove from './phases/validateMove.js';
import * as attach from './units/attach.js';

const modules: Record<string, { ruleRefs: readonly string[] }> = {
  allocation,
  gatherDice,
  hazard,
  hitRoll,
  inflictDamage,
  modifiers,
  mortalWounds,
  resolveAttacks,
  saveRoll,
  woundChart,
  woundRoll,
  battlefield,
  coherency,
  measure,
  visibility,
  diceExpr,
  flow,
  state,
  charge,
  command,
  deployment,
  fight,
  legal,
  movement,
  objectives,
  reserves,
  chargeProximity,
  shooting,
  stratagems,
  validateMove,
  attach,
};

export const engineRuleRefs: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(Object.entries(modules).map(([k, m]) => [k, m.ruleRefs])),
  ...Object.fromEntries(
    implementedKeywords.map((id) => [`keyword:${id}`, keywordModule(id)!.ruleRefs]),
  ),
};
