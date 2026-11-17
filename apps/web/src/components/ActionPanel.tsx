import {
  type GameState,
  type UnitState,
  aliveModels,
  canConsolidate,
  chargePositions,
  canDeclareCharge,
  canPileIn,
  checkTarget,
  formation,
  consolidationMode,
  eligibleMoveTypes,
  eligibleShootingTypes,
  eligibleToFight,
  engagedEnemies,
  fightsFirst,
  moveToward,
  pileInTargets,
  possibleChargeTargets,
  stepModelsToward,
  weaponAllowed,
  apply,
  hasDeepStrike,
  canEmbark,
  disembarkMode,
  isTransport,
} from '@battle-drill/engine';
import { useState } from 'react';
import { ERROR_TEXT } from '../game/messages.js';
import { useGame } from '../game/store.js';
import { WhatNow } from './WhatNow.js';

const enemies = (state: GameState, unit: UnitState) =>
  Object.values(state.units).filter(
    (u) => u.player !== unit.player && aliveModels(u).some((m) => m.position),
  );

function MovementControls({ state, unit }: { state: GameState; unit: UnitState }) {
  const { act, pending, dragMode, setDragMode } = useGame();
  const types = eligibleMoveTypes(state, unit.id);
  const st = state.status[unit.id]!;
  if (st.inReserves)
    return types.includes('ingress') ? (
      <p className="small" data-testid="arrive-hint">
        {hasDeepStrike(unit)
          ? 'Deep Strike: click anywhere on the battlefield more than 8" from every enemy (outside the red rings).'
          : 'Click inside the yellow band, within 6" of a battlefield edge and more than 8" from every enemy.'}
      </p>
    ) : (
      <p className="muted small">
        In reserves. It can arrive in the movement phase from battle round 2.
      </p>
    );
  if (st.embarkedIn) {
    const transport = state.units[st.embarkedIn];
    const mode = disembarkMode(state, unit.id);
    return mode ? (
      <p className="small" data-testid="disembark-hint">
        Embarked in {transport?.name}. Click the battlefield next to it to disembark: every model
        must be wholly within 3&quot;.{' '}
        {mode === 'rapid'
          ? 'The transport already moved, so this is a rapid disembark: the unit cannot charge this turn.'
          : 'The transport has not moved, so this is a tactical disembark: the unit can still make a normal or advance move.'}
      </p>
    ) : (
      <p className="muted small">
        Embarked in {transport?.name}.{' '}
        {st.embarkedThisTurn
          ? 'It embarked this turn, so it stays inside.'
          : 'It cannot disembark now (the transport advanced or fell back, or it is not your movement phase).'}
      </p>
    );
  }
  if (types.length === 0) {
    const ride = Object.values(state.units).filter(
      (t) => t.player === unit.player && canEmbark(state, unit.id, t.id) === null,
    );
    return (
      <>
        <p className="muted small">This unit has already moved.</p>
        {ride.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid="embark"
            onClick={() => act({ type: 'embark', unitId: unit.id, transportId: t.id })}
          >
            Embark in {t.name}
          </button>
        ))}
      </>
    );
  }
  const mine = pending?.unitId === unit.id ? pending : null;
  return (
    <div className="controls">
      <p className="small">Pick a move, then drag the unit on the battlefield.</p>
      <div className="button-row" role="group" aria-label="Move type">
        {types.includes('normal') && (
          <button
            type="button"
            aria-pressed={dragMode === 'normal'}
            onClick={() => setDragMode('normal')}
            data-tutorial-id="move-normal"
          >
            Normal move ({Math.min(...aliveModels(unit).map((m) => m.movement ?? 0))}&quot;)
          </button>
        )}
        {types.includes('advance') &&
          (st.advanceRoll === null ? (
            <button
              type="button"
              onClick={() =>
                act({ type: 'advanceRoll', unitId: unit.id }) && setDragMode('advance')
              }
              data-tutorial-id="move-advance"
            >
              Advance (roll D6)
            </button>
          ) : (
            <button
              type="button"
              aria-pressed={dragMode === 'advance'}
              onClick={() => setDragMode('advance')}
            >
              Advance (+{st.advanceRoll}&quot;)
            </button>
          ))}
        {types.includes('fall-back') && (
          <button
            type="button"
            aria-pressed={dragMode === 'fall-back'}
            onClick={() => setDragMode('fall-back')}
            data-tutorial-id="move-fall-back"
          >
            Fall back
          </button>
        )}
        <button
          type="button"
          onClick={() => act({ type: 'move', unitId: unit.id, moveType: 'stationary' })}
          data-tutorial-id="move-stationary"
        >
          Remain stationary
        </button>
      </div>
      {mine && (
        <div className="button-row">
          <button
            type="button"
            className="primary"
            data-tutorial-id="confirm-move"
            data-testid="confirm-move"
            onClick={() =>
              act({ type: 'move', unitId: unit.id, moveType: dragMode, positions: mine.positions })
            }
          >
            Confirm {dragMode === 'fall-back' ? 'fall back' : dragMode} move
          </button>
          <button type="button" onClick={() => useGame.getState().setPending(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ShootingControls({ state, unit }: { state: GameState; unit: UnitState }) {
  const act = useGame((s) => s.act);
  const types = eligibleShootingTypes(state, unit.id);
  const [type, setType] = useState(types[0]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  if (types.length === 0) return <p className="muted small">This unit cannot shoot now.</p>;
  const current = type && types.includes(type) ? type : types[0]!;
  const foes = enemies(state, unit);
  const weapons = unit.weapons.filter((w) => weaponAllowed(unit, w, current));
  const targets = Object.fromEntries(
    weapons.map((w) => [
      w.name,
      foes.filter((f) => checkTarget(state, unit, w, current, f) === null),
    ]),
  );
  const selection = Object.fromEntries(
    weapons
      .map((w) => [w.name, chosen[w.name] ?? targets[w.name]?.[0]?.id ?? ''])
      .filter(([, t]) => t),
  );
  return (
    <div className="controls">
      {types.length > 1 && (
        <label>
          Shooting type{' '}
          <select value={current} onChange={(e) => setType(e.target.value as typeof current)}>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      )}
      {current === 'indirect' && (
        <p className="small" data-testid="indirect-hint">
          Indirect shooting: indirect fire weapons may target units out of sight. Those attacks
          always give the target cover, and an unmodified hit roll of 1-5 fails (1-3 if this unit
          remained stationary and a friendly unit can see the target).
        </p>
      )}
      <table className="fire-table">
        <tbody>
          {weapons.map((w) => (
            <tr key={w.name}>
              <td>{w.name}</td>
              <td>
                <select
                  aria-label={`Target for ${w.name}`}
                  value={selection[w.name] ?? ''}
                  onChange={(e) => setChosen({ ...chosen, [w.name]: e.target.value })}
                >
                  <option value="">(do not fire)</option>
                  {targets[w.name]!.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {targets[w.name]!.length === 0 && (
                  <span className="small muted"> no target in range and sight</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="primary"
        disabled={Object.keys(selection).length === 0}
        data-tutorial-id="fire"
        data-testid="fire"
        onClick={() =>
          act({ type: 'shoot', unitId: unit.id, shootingType: current, targets: selection })
        }
      >
        Fire
      </button>
    </div>
  );
}

function ChargeControls({ state, unit }: { state: GameState; unit: UnitState }) {
  const act = useGame((s) => s.act);
  const st = state.status[unit.id]!;
  if (st.charged) return <p className="small">Charged! This unit fights first.</p>;
  if (!st.declaredCharge) {
    const problem = canDeclareCharge(state, unit.id);
    if (problem) return <p className="muted small">{ERROR_TEXT[problem.code]}</p>;
    return (
      <button
        type="button"
        className="primary"
        onClick={() => act({ type: 'declareCharge', unitId: unit.id })}
        data-tutorial-id="declare-charge"
        data-testid="declare-charge"
      >
        Declare charge (roll 2D6)
      </button>
    );
  }
  if (st.chargeRoll === null) return <p className="muted small">Charge resolved.</p>;
  const targets = possibleChargeTargets(state, unit.id);
  const tryCharge = (targetId: string) => {
    const target = state.units[targetId]!;
    for (const gap of [0.5, 1, 1.5, 0.2]) {
      const positions = chargePositions(state, unit, [target], st.chargeRoll!, gap);
      if (
        positions &&
        apply(state, { type: 'chargeMove', unitId: unit.id, targetIds: [targetId], positions }).ok
      ) {
        act({ type: 'chargeMove', unitId: unit.id, targetIds: [targetId], positions });
        return;
      }
    }
    useGame.setState({ lastError: { code: 'NOT_ALL_TARGETS_ENGAGED', detail: 'no path found' } });
  };
  return (
    <div className="controls">
      <p className="small">You rolled {st.chargeRoll}&quot;.</p>
      <div className="button-row">
        {targets.map((t) => (
          <button
            key={t.id}
            type="button"
            className="primary"
            onClick={() => tryCharge(t.id)}
            data-tutorial-id={`charge-${t.id}`}
            data-testid="charge-target"
          >
            Charge {t.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => act({ type: 'skipCharge', unitId: unit.id })}
          data-tutorial-id="skip-charge"
        >
          {targets.length === 0 ? 'Charge failed: continue' : 'Do not charge'}
        </button>
      </div>
    </div>
  );
}

function FightControls({ state, unit }: { state: GameState; unit: UnitState }) {
  const act = useGame((s) => s.act);
  if (state.fightStep === 'pile-in') {
    if (!canPileIn(state, unit.id))
      return <p className="muted small">This unit does not pile in.</p>;
    return (
      <button
        type="button"
        className="primary"
        data-tutorial-id="pile-in"
        onClick={() =>
          act({
            type: 'pileIn',
            unitId: unit.id,
            positions: stepModelsToward(state, unit, pileInTargets(state, unit), 3),
          })
        }
      >
        Pile in (up to 3&quot;)
      </button>
    );
  }
  if (state.fightStep === 'fight') {
    if (state.fightSelector !== 'p1')
      return <p className="muted small">Waiting for the opponent.</p>;
    if (!eligibleToFight(state, unit.id))
      return <p className="muted small">This unit cannot fight now.</p>;
    const engaged = engagedEnemies(state, unit);
    const targets = engaged.length > 0 ? engaged : pileInTargets(state, unit);
    return (
      <div className="controls">
        {fightsFirst(state, unit.id) && <p className="small">Fights First (it charged).</p>}
        <div className="button-row">
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              className="primary"
              data-tutorial-id={`fight-${t.id}`}
              data-testid="fight"
              onClick={() =>
                act({
                  type: 'fight',
                  unitId: unit.id,
                  targetId: t.id,
                  ...(engaged.length === 0
                    ? { pileInPositions: stepModelsToward(state, unit, [t], 3) }
                    : {}),
                })
              }
            >
              Fight {t.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!canConsolidate(state, unit.id))
    return <p className="muted small">This unit does not consolidate.</p>;
  const mode = consolidationMode(state, unit)!;
  const positions =
    mode.mode === 'objective'
      ? moveToward(unit, mode.objective!, 3)
      : stepModelsToward(state, unit, mode.targets, 3);
  return (
    <button
      type="button"
      className="primary"
      data-tutorial-id="consolidate"
      onClick={() => act({ type: 'consolidate', unitId: unit.id, positions })}
    >
      Consolidate ({mode.mode}, up to 3&quot;)
    </button>
  );
}

/** Units waiting off the board cannot be clicked there, so they are listed here. */
function ReserveList({ state }: { state: GameState }) {
  const { select, selectedUnitId } = useGame();
  const waiting = Object.values(state.units).filter(
    (u) =>
      u.player === 'p1' &&
      (state.status[u.id]?.inReserves || state.status[u.id]?.embarkedIn) &&
      aliveModels(u).length > 0,
  );
  if (waiting.length === 0) return null;
  return (
    <div className="controls" data-tutorial-id="reserve-list">
      <h4>Off the battlefield</h4>
      <ul className="reserve-list">
        {waiting.map((u) => (
          <li key={u.id}>
            <span>
              {u.name}
              {state.status[u.id]?.embarkedIn ? (
                <span className="tag">
                  in {state.units[state.status[u.id]!.embarkedIn!]?.name ?? 'transport'}
                </span>
              ) : (
                <span className="tag">reserves</span>
              )}
              {hasDeepStrike(u) && <span className="tag">Deep Strike</span>}
            </span>
            <button
              type="button"
              aria-pressed={selectedUnitId === u.id}
              data-testid={`select-reserve-${u.id}`}
              onClick={() => select(u.id)}
            >
              Select
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeploymentControls({ state }: { state: GameState }) {
  const act = useGame((s) => s.act);
  const pending = Object.values(state.units).filter(
    (u) =>
      u.player === 'p1' &&
      aliveModels(u).length > 0 &&
      !aliveModels(u).some((m) => m.position) &&
      !state.status[u.id]?.inReserves &&
      !state.status[u.id]?.embarkedIn,
  );
  const transports = Object.values(state.units).filter((u) => u.player === 'p1' && isTransport(u));
  const reserves = Object.values(state.units).filter(
    (u) => u.player === 'p1' && state.status[u.id]?.inReserves,
  );
  const zone = state.battlefield.deploymentZones.find((z) => z.player === 'p1');
  const place = (unit: UnitState): boolean => {
    if (!zone) return false;
    const ys = zone.polygon.map((p) => p.y);
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (let i = 0; i < 24; i++) {
      const x = ((((i * 7) % 23) + 1) / 24) * state.battlefield.width;
      const positions = formation(unit, { x, y });
      const current = useGame.getState().history?.current ?? state;
      if (apply(current, { type: 'deploy', unitId: unit.id, positions }).ok)
        return act({ type: 'deploy', unitId: unit.id, positions });
    }
    return false;
  };
  return (
    <div className="controls">
      <h4>Deployment</h4>
      {pending.length === 0 ? (
        <p className="small">All your units are deployed. Start the battle when ready.</p>
      ) : (
        <>
          <p className="small">
            Set up each unit in your zone. The opponent deploys after each of yours.
          </p>
          <ul className="deploy-list">
            {pending.map((u) => (
              <li key={u.id}>
                {u.name}{' '}
                <button type="button" onClick={() => place(u)}>
                  Deploy
                </button>{' '}
                <button
                  type="button"
                  className="link"
                  data-testid={`reserve-${u.id}`}
                  onClick={() => act({ type: 'placeInReserves', unitId: u.id })}
                >
                  Reserves
                </button>
                {transports
                  .filter((t) => canEmbark(state, u.id, t.id) === null)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="link"
                      data-testid={`embark-${u.id}`}
                      onClick={() => act({ type: 'embark', unitId: u.id, transportId: t.id })}
                    >
                      Embark in {t.name}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="primary"
            data-tutorial-id="deploy-all"
            data-testid="deploy-all"
            onClick={() => {
              for (const u of pending) {
                const s = useGame.getState().history?.current;
                const fresh = s?.units[u.id];
                if (fresh && !aliveModels(fresh).some((m) => m.position)) place(fresh);
              }
            }}
          >
            Deploy all
          </button>
        </>
      )}
      {reserves.length > 0 && (
        <p className="small">In strategic reserves: {reserves.map((u) => u.name).join(', ')}.</p>
      )}
    </div>
  );
}

export function ActionPanel({ state }: { state: GameState }) {
  const { selectedUnitId, lastError } = useGame();
  const unit = selectedUnitId ? state.units[selectedUnitId] : undefined;
  const yours = unit?.player === 'p1';
  if (state.phase === 'deployment')
    return (
      <section className="action-panel" data-testid="action-panel" data-tutorial-id="action-panel">
        {lastError && <p className="error">{ERROR_TEXT[lastError.code]}</p>}
        <DeploymentControls state={state} />
      </section>
    );
  return (
    <section className="action-panel" data-testid="action-panel" data-tutorial-id="action-panel">
      {lastError && (
        <p className="error" role="alert" data-testid="rule-error">
          {ERROR_TEXT[lastError.code]}
        </p>
      )}
      <ReserveList state={state} />
      {!unit && <p className="muted small">Select one of your units on the battlefield.</p>}
      {unit && !yours && <p className="small">Enemy unit. Select one of yours to act.</p>}
      {unit && yours && aliveModels(unit).length === 0 && (
        <p className="muted small">This unit was destroyed.</p>
      )}
      {unit && yours && aliveModels(unit).length > 0 && (
        <>
          <h4>{unit.name}</h4>
          <WhatNow state={state} unitId={unit.id} />
          {state.phase === 'command' && (
            <p className="small">
              Command phase: both players gained 1 CP. Battle-shock tests happen here.
            </p>
          )}
          {state.phase === 'movement' && state.activePlayer === 'p1' && (
            <MovementControls state={state} unit={unit} />
          )}
          {state.phase === 'shooting' && state.activePlayer === 'p1' && (
            <ShootingControls key={unit.id} state={state} unit={unit} />
          )}
          {state.phase === 'charge' && state.activePlayer === 'p1' && (
            <ChargeControls state={state} unit={unit} />
          )}
          {state.phase === 'fight' && <FightControls state={state} unit={unit} />}
        </>
      )}
    </section>
  );
}
