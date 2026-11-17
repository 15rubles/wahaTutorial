import type { Stratagem } from '@battle-drill/data';
import type { GameState } from '@battle-drill/engine';
import { useArmy } from '../army/store.js';
import { useData } from '../data/store.js';
import { useGame } from '../game/store.js';
import { useRulePopup } from '../game/rulePopup.js';
import { RuleHtml } from './RuleHtml.js';

/** Core stratagems plus the army's detachment stratagems, with CP costs and a Use button. */
export function StratagemPanel({ state }: { state: GameState }) {
  const game = useData((s) => s.game);
  const army = useArmy((s) => s.army);
  const act = useGame((s) => s.act);
  const openRule = useRulePopup((s) => s.open);
  if (!game) return null;
  const core = game.stratagems.filter((s) => !s.factionId && /^core\b/i.test(s.type));
  const detachment = game.stratagems.filter(
    (s) => !!army && army.detachmentIds.includes(s.detachmentId),
  );
  const used = new Set(
    state.stratagemsThisPhase.filter((s) => s.player === 'p1').map((s) => s.stratagemId),
  );
  const cp = state.players.p1.cp;

  const card = (s: Stratagem) => {
    const cost = s.cpCost ?? 0;
    const disabled =
      used.has(s.id) || cp < cost || state.phase === 'deployment' || state.phase === 'game-over';
    return (
      <li key={s.id} className="stratagem">
        <details>
          <summary>
            <strong>{s.name}</strong> <span className="tag">{cost} CP</span>{' '}
            <span className="small muted">
              {s.turn}
              {s.phase ? `, ${s.phase}` : ''}
            </span>
          </summary>
          <RuleHtml html={s.descriptionHtml} onRuleLink={openRule} className="small" />
        </details>
        <button
          type="button"
          disabled={disabled}
          data-testid="use-stratagem"
          onClick={() => act({ type: 'useStratagem', player: 'p1', stratagemId: s.id, cost })}
          title={
            used.has(s.id) ? 'Already used this phase' : cp < cost ? 'Not enough CP' : 'Spend CP'
          }
        >
          Use
        </button>
      </li>
    );
  };

  return (
    <section
      className="panel stratagem-panel"
      data-tutorial-id="stratagems"
      data-testid="stratagems"
    >
      <h4>
        Stratagems <span className="small muted">({cp} CP)</span>
      </h4>
      <p className="small muted">
        Timing is shown on each card; effects are applied by reading the card.
      </p>
      {detachment.length > 0 && (
        <>
          <h5>Your detachment</h5>
          <ul>{detachment.map(card)}</ul>
        </>
      )}
      <h5>Core</h5>
      <ul>{core.map(card)}</ul>
    </section>
  );
}
