import type { Datasheet } from '@battle-drill/data';
import {
  type UnitState,
  aliveModels,
  exprToString,
  unimplementedKeywords,
} from '@battle-drill/engine';
import { useData } from '../data/store.js';
import { useRulePopup } from '../game/rulePopup.js';
import { KeywordChip } from './RulePopup.js';
import { RuleHtml } from './RuleHtml.js';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

interface Props {
  datasheet?: Datasheet | undefined;
  unit?: UnitState | undefined;
}

/** Full datasheet from the cache, plus live wounds when the unit is in a game. */
export function UnitCard({ datasheet, unit }: Props) {
  const rules = useData((s) => s.rules);
  const game = useData((s) => s.game);
  const openRule = useRulePopup((s) => s.open);
  const index = rules?.index;
  const name = datasheet?.name ?? unit?.name ?? 'Unit';

  const weapons = unit?.weapons ?? [];
  const profiles = datasheet?.models ?? [];
  const keywords = datasheet
    ? [...new Set(datasheet.keywords.map((k) => k.keyword))]
    : (unit?.keywords ?? []);
  const unitRule = (k: string) => index?.unitKeywords[slug(k)] ?? index?.mentions[slug(k)]?.[0];

  return (
    <article className="unit-card" data-testid="unit-card" data-tutorial-id="unit-card">
      <h3>{name}</h3>
      {unit && (
        <p className="small">
          {aliveModels(unit).length}/{unit.startingStrength} models,{' '}
          {aliveModels(unit).reduce((n, m) => n + m.woundsLeft, 0)} wounds left
        </p>
      )}

      <table className="stat-table" data-tutorial-id="profile-table">
        <thead>
          <tr>
            <th>Model</th>
            <th title="Move">M</th>
            <th title="Toughness">T</th>
            <th title="Save">Sv</th>
            <th title="Wounds">W</th>
            <th title="Leadership">Ld</th>
            <th title="Objective Control">OC</th>
          </tr>
        </thead>
        <tbody>
          {(profiles.length > 0
            ? profiles.map((p) => ({
                name: p.name || name,
                m: p.movementRaw,
                t: p.toughness,
                sv: p.save,
                inv: p.invuln,
                w: p.wounds,
                ld: p.leadership,
                oc: p.objectiveControl,
              }))
            : unit
              ? [aliveModels(unit)[0] ?? unit.models[0]!].map((m) => ({
                  name: m.name,
                  m: `${m.movement}"`,
                  t: m.toughness,
                  sv: m.save,
                  inv: m.invuln,
                  w: m.wounds,
                  ld: m.leadership,
                  oc: m.objectiveControl,
                }))
              : []
          ).map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.m}</td>
              <td>{p.t}</td>
              <td>
                {p.sv}+{p.inv ? ` (${p.inv}++)` : ''}
              </td>
              <td>{p.w}</td>
              <td>{p.ld}+</td>
              <td>{p.oc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="stat-table weapons" data-tutorial-id="weapon-table">
        <thead>
          <tr>
            <th>Weapon</th>
            <th title="Range">R</th>
            <th title="Attacks">A</th>
            <th title="Ballistic / Weapon Skill">BS/WS</th>
            <th title="Strength">S</th>
            <th title="Armour Penetration">AP</th>
            <th title="Damage">D</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w) => (
            <tr key={w.name}>
              <td>
                {w.name}
                <div>
                  {w.keywords.map((k, i) => (
                    <KeywordChip
                      key={i}
                      label={`${k.id === 'anti' ? `anti-${k.target ?? ''}` : k.id}${k.param ? ` ${k.param}` : ''}${k.condition ? ` (${k.condition})` : ''}`}
                      ruleId={index?.weaponKeywords[k.id]}
                    />
                  ))}
                  {unimplementedKeywords(w).length > 0 && (
                    <span className="small muted"> (some abilities not simulated)</span>
                  )}
                </div>
              </td>
              <td>{w.range === null ? 'Melee' : `${w.range}"`}</td>
              <td>{exprToString(w.attacks)}</td>
              <td>{w.skill ? `${w.skill}+` : 'N/A'}</td>
              <td>{exprToString(w.strength)}</td>
              <td>{w.ap}</td>
              <td>{exprToString(w.damage)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {datasheet && datasheet.abilities.length > 0 && (
        <section className="abilities" data-tutorial-id="abilities">
          <h4>Abilities</h4>
          {datasheet.abilities.map((a) => {
            const shared = a.abilityId
              ? game?.abilities.find((x) => x.id === a.abilityId)
              : undefined;
            const title = a.name || shared?.name || 'Ability';
            const ruleId = a.abilityId ? index?.abilities[a.abilityId] : undefined;
            const html = a.descriptionHtml || shared?.descriptionHtml || '';
            return (
              <details key={a.line}>
                <summary>
                  {title} {a.parameter && <span className="muted">{a.parameter}</span>}{' '}
                  <span className="small muted">{a.type}</span>
                </summary>
                {ruleId && (
                  <button type="button" className="link small" onClick={() => openRule(ruleId)}>
                    core rule
                  </button>
                )}
                {html && <RuleHtml html={html} onRuleLink={openRule} />}
              </details>
            );
          })}
        </section>
      )}

      <section className="keywords" data-tutorial-id="keywords">
        <h4>Keywords</h4>
        {keywords.map((k) => (
          <KeywordChip key={k} label={k} ruleId={unitRule(k)} />
        ))}
      </section>
    </article>
  );
}
