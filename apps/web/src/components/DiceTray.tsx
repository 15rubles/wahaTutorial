import type { GameEvent } from '@battle-drill/engine';
import { useGame } from '../game/store.js';

const HIT_CLASS: Record<string, string> = {
  fail: 'die-fail',
  hit: 'die-ok',
  critical: 'die-crit',
  auto: 'die-auto',
};

function Die({
  value,
  cls,
  i,
  title,
}: {
  value: number | null;
  cls: string;
  i: number;
  title: string;
}) {
  return (
    <span className={`die ${cls}`} style={{ ['--i' as string]: i }} title={title}>
      {value ?? 'A'}
    </span>
  );
}

/** Dice from the last action, with a short animation and a step by step breakdown. */
export function DiceTray({ events }: { events: readonly GameEvent[] }) {
  const rollId = useGame((s) => s.rollId);
  const blocks: JSX.Element[] = [];
  let k = 0;
  for (const e of events) {
    if (e.type === 'AttackDiceGathered') {
      blocks.push(
        <div key={k++} className="tray-line">
          <strong>{e.weapon}</strong>: {e.total} attack dice
          {e.bonus.length > 0 && (
            <span className="muted">
              {' '}
              ({e.bonus.map((b) => `+${b.dice} ${b.keyword}`).join(', ')})
            </span>
          )}
        </div>,
      );
    } else if (e.type === 'HitRolled') {
      blocks.push(
        <div key={k++} className="tray-line" data-testid="hit-rolls">
          <span className="tray-label">
            Hit{' '}
            {e.target
              ? `(${e.target}+${e.modifier ? `, ${e.modifier > 0 ? '+' : ''}${e.modifier}` : ''})`
              : '(automatic)'}
          </span>
          {e.rolls.map((r, i) => (
            <Die key={i} i={i} value={r.roll} cls={HIT_CLASS[r.outcome]!} title={r.outcome} />
          ))}
          <span className="tray-sum">
            {e.hits} hits{e.criticals ? `, ${e.criticals} critical` : ''}
            {e.extraHits ? `, +${e.extraHits} extra` : ''}
            {e.autoWounds ? `, ${e.autoWounds} auto-wound` : ''}
          </span>
        </div>,
      );
    } else if (e.type === 'WoundRolled') {
      blocks.push(
        <div key={k++} className="tray-line" data-testid="wound-rolls">
          <span className="tray-label">
            Wound (S{e.strength} vs T{e.toughness}: {e.target}+)
          </span>
          {e.rolls.map((r, i) => (
            <Die
              key={i}
              i={i}
              value={r.roll}
              cls={HIT_CLASS[r.outcome === 'wound' ? 'hit' : r.outcome]!}
              title={r.rerolledFrom ? `re-rolled from ${r.rerolledFrom}` : r.outcome}
            />
          ))}
          <span className="tray-sum">
            {e.wounds} wounds{e.criticals ? `, ${e.criticals} critical` : ''}
            {e.devastating ? `, ${e.devastating} mortal` : ''}
          </span>
        </div>,
      );
    } else if (e.type === 'SaveRolled') {
      blocks.push(
        <div key={k++} className="tray-line" data-testid="save-rolls">
          <span className="tray-label">Saves (AP {e.ap})</span>
          {e.rolls.map((r, i) => (
            <Die
              key={i}
              i={i}
              value={r.roll}
              cls={r.outcome === 'damage' ? 'die-fail' : 'die-ok'}
              title={r.outcome}
            />
          ))}
          <span className="tray-sum">{e.failed} failed</span>
        </div>,
      );
    } else if (e.type === 'AttacksResolved') {
      blocks.push(
        <div key={k++} className="tray-line tray-result">
          {e.woundsInflicted} damage, {e.modelsDestroyed} model{e.modelsDestroyed === 1 ? '' : 's'}{' '}
          destroyed
        </div>,
      );
    } else if (e.type === 'ChargeDeclared') {
      blocks.push(
        <div key={k++} className="tray-line" data-testid="charge-roll">
          <span className="tray-label">Charge roll</span>
          {e.rolls.map((r, i) => (
            <Die key={i} i={i} value={r} cls="die-auto" title="charge" />
          ))}
          <span className="tray-sum">= {e.distance}&quot;</span>
        </div>,
      );
    } else if (e.type === 'AdvanceRolled') {
      blocks.push(
        <div key={k++} className="tray-line">
          <span className="tray-label">Advance roll</span>
          <Die i={0} value={e.roll} cls="die-auto" title="advance" />
        </div>,
      );
    } else if (e.type === 'BattleShockRolled') {
      blocks.push(
        <div key={k++} className="tray-line">
          <span className="tray-label">Battle-shock ({e.target}+)</span>
          {e.rolls.map((r, i) => (
            <Die
              key={i}
              i={i}
              value={r}
              cls={e.passed ? 'die-ok' : 'die-fail'}
              title={e.passed ? 'passed' : 'failed'}
            />
          ))}
        </div>,
      );
    } else if (e.type === 'HazardRolled') {
      blocks.push(
        <div key={k++} className="tray-line">
          <span className="tray-label">Hazard</span>
          {e.rolls.map((r, i) => (
            <Die key={i} i={i} value={r} cls={r <= 2 ? 'die-fail' : 'die-ok'} title="hazard" />
          ))}
          <span className="tray-sum">{e.mortalWounds} mortal wounds</span>
        </div>,
      );
    }
  }
  return (
    <section
      className="dice-tray"
      aria-live="polite"
      data-testid="dice-tray"
      data-tutorial-id="dice-tray"
      key={rollId}
    >
      <h4>Dice</h4>
      {blocks.length > 0 ? blocks : <p className="muted small">Rolls show up here.</p>}
    </section>
  );
}
