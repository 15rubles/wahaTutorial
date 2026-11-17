import { useArmy } from '../army/store.js';
import { useData } from '../data/store.js';
import { useRulePopup } from '../game/rulePopup.js';
import { RuleHtml } from './RuleHtml.js';

/** Army rule (faction abilities), detachment rule and enhancements from the local cache. */
export function ArmyRulesPanel() {
  const game = useData((s) => s.game);
  const army = useArmy((s) => s.army);
  const openRule = useRulePopup((s) => s.open);
  if (!game) return null;
  if (!army)
    return (
      <section className="panel" data-tutorial-id="army-rule">
        <p className="small">
          Import your army to see your own army rule, detachment and enhancements here.
        </p>
        <div data-tutorial-id="detachment-rule" />
        <div data-tutorial-id="enhancements" />
      </section>
    );
  const faction = game.factions.find((f) => f.id === army.factionId);
  const armyRules = game.abilities.filter(
    (a) => army.factionId && a.factionIds.includes(army.factionId),
  );
  const detachment = game.detachments.find((d) => d.id === army.detachmentId);
  const detRules = game.detachmentAbilities.filter((a) => a.detachmentId === army.detachmentId);
  const enhancements = game.enhancements.filter((e) => e.detachmentId === army.detachmentId);
  const taken = new Set(army.units.flatMap((u) => u.enhancementIds));
  return (
    <section className="panel army-rules">
      <div data-tutorial-id="army-rule">
        <h4>Army rule {faction && <span className="small muted">({faction.name})</span>}</h4>
        {armyRules.length === 0 && <p className="small muted">No faction ability in the data.</p>}
        {armyRules.map((a) => (
          <details key={a.id}>
            <summary>{a.name}</summary>
            <RuleHtml html={a.descriptionHtml} onRuleLink={openRule} className="small" />
          </details>
        ))}
      </div>
      <div data-tutorial-id="detachment-rule">
        <h4>Detachment {detachment && <span className="small muted">({detachment.name})</span>}</h4>
        {!detachment && (
          <p className="small muted">No detachment selected (pick one on the army page).</p>
        )}
        {detRules.map((a) => (
          <details key={a.id}>
            <summary>{a.name}</summary>
            <RuleHtml html={a.descriptionHtml} onRuleLink={openRule} className="small" />
          </details>
        ))}
      </div>
      <div data-tutorial-id="enhancements">
        <h4>Enhancements</h4>
        <ul>
          {enhancements.map((e) => (
            <li key={e.id}>
              <details>
                <summary>
                  {e.name} <span className="small muted">{e.points ?? '-'} pts</span>{' '}
                  {taken.has(e.id) && <span className="tag">taken</span>}
                </summary>
                <RuleHtml html={e.descriptionHtml} onRuleLink={openRule} className="small" />
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
