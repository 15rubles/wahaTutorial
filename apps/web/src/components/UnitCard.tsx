import type { Datasheet } from '@battle-drill/data';
import {
  type UnitState,
  type Weapon,
  aliveModels,
  exprToString,
  unimplementedKeywords,
} from '@battle-drill/engine';
import { PieceArt, pieceType } from '../art/pieces.js';
import { useData } from '../data/store.js';
import { useRulePopup } from '../game/rulePopup.js';
import { BladesIcon, CrosshairIcon } from './Icons.js';
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

interface Profile {
  name: string;
  m: string;
  t: number;
  sv: number;
  inv: number | null;
  w: number;
  ld: number;
  oc: number;
}

function WeaponTable({
  title,
  icon,
  skill,
  weapons,
  ruleFor,
}: {
  title: string;
  icon: JSX.Element;
  skill: string;
  weapons: readonly Weapon[];
  ruleFor: (id: string) => string | undefined;
}) {
  if (weapons.length === 0) return null;
  return (
    <table className="ds-table">
      <thead>
        <tr>
          <th>
            <span className="bar-title">
              {icon} {title}
            </span>
          </th>
          <th title="Range">Range</th>
          <th title="Attacks">A</th>
          <th title={skill === 'BS' ? 'Ballistic Skill' : 'Weapon Skill'}>{skill}</th>
          <th title="Strength">S</th>
          <th title="Armour Penetration">AP</th>
          <th title="Damage">D</th>
        </tr>
      </thead>
      <tbody>
        {weapons.map((w) => (
          <tr key={w.name}>
            <td>
              <b>{w.name}</b>{' '}
              {w.keywords.map((k, i) => (
                <KeywordChip
                  key={i}
                  label={`${k.id === 'anti' ? `anti-${k.target ?? ''}` : k.id}${k.param ? ` ${k.param}` : ''}${k.condition ? ` (${k.condition})` : ''}`}
                  ruleId={ruleFor(k.id)}
                />
              ))}
              {unimplementedKeywords(w).length > 0 && (
                <span className="small muted"> (some abilities not simulated)</span>
              )}
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
  );
}

/** Datasheet-style card: the cache's datasheet, plus live wounds when the unit is in a game. */
export function UnitCard({ datasheet, unit }: Props) {
  const rules = useData((s) => s.rules);
  const game = useData((s) => s.game);
  const openRule = useRulePopup((s) => s.open);
  const index = rules?.index;
  const name = datasheet?.name ?? unit?.name ?? 'Unit';
  const side = unit?.player ?? 'p1';

  const weapons = unit?.weapons ?? [];
  const profiles: Profile[] =
    datasheet && datasheet.models.length > 0
      ? datasheet.models.map((p) => ({
          name: p.name || name,
          m: p.movementRaw || '-',
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
            m: m.movement === null ? '-' : `${m.movement}"`,
            t: m.toughness,
            sv: m.save,
            inv: m.invuln,
            w: m.wounds,
            ld: m.leadership,
            oc: m.objectiveControl,
          }))
        : [];
  const main = profiles[0];
  const unitKeywords = datasheet
    ? [...new Set(datasheet.keywords.filter((k) => !k.isFactionKeyword).map((k) => k.keyword))]
    : (unit?.keywords ?? []);
  const factionKeywords = datasheet
    ? [...new Set(datasheet.keywords.filter((k) => k.isFactionKeyword).map((k) => k.keyword))]
    : [];
  const unitRule = (k: string) => index?.unitKeywords[slug(k)] ?? index?.mentions[slug(k)]?.[0];
  const type = pieceType(
    (unit?.keywords ?? unitKeywords).map((k) => k.toUpperCase()),
    unit?.datasheetId ?? '',
  );
  const faction = datasheet ? game?.factions.find((f) => f.id === datasheet.factionId) : undefined;

  return (
    <article className="unit-card datasheet" data-testid="unit-card" data-tutorial-id="unit-card">
      <header className={`ds-head side-${side}`}>
        <div className="ds-band" />
        <h3>{name}</h3>
        {main && (
          <div className="ds-stats" data-tutorial-id="profile-table">
            {(
              [
                ['M', main.m, 'Move'],
                ['T', main.t, 'Toughness'],
                ['SV', `${main.sv}+`, 'Save'],
                ['W', main.w, 'Wounds'],
                ['LD', `${main.ld}+`, 'Leadership'],
                ['OC', main.oc, 'Objective Control'],
              ] as const
            ).map(([k, v, t]) => (
              <div className="ds-stat" key={k} title={t}>
                <small>{k}</small>
                <b>{v}</b>
              </div>
            ))}
            {main.inv && (
              <div className="ds-stat ds-inv" title="Invulnerable save">
                <small>INV</small>
                <b>{main.inv}+</b>
              </div>
            )}
          </div>
        )}
        <div className="ds-art">
          <PieceArt type={type} side={side} size={92} />
        </div>
      </header>

      {unit && (
        <p className="ds-live">
          {aliveModels(unit).length}/{unit.startingStrength} models,{' '}
          {aliveModels(unit).reduce((n, m) => n + m.woundsLeft, 0)} wounds left
        </p>
      )}
      {profiles.length > 1 && (
        <table className="ds-table ds-profiles">
          <tbody>
            {profiles.slice(1).map((p) => (
              <tr key={p.name}>
                <td>
                  <b>{p.name}</b>
                </td>
                <td>M {p.m}</td>
                <td>T {p.t}</td>
                <td>
                  Sv {p.sv}+{p.inv ? ` (${p.inv}++)` : ''}
                </td>
                <td>W {p.w}</td>
                <td>Ld {p.ld}+</td>
                <td>OC {p.oc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="ds-weapons" data-tutorial-id="weapon-table">
        <WeaponTable
          title="Ranged weapons"
          icon={<CrosshairIcon />}
          skill="BS"
          weapons={weapons.filter((w) => w.type === 'ranged')}
          ruleFor={(id) => index?.weaponKeywords[id]}
        />
        <WeaponTable
          title="Melee weapons"
          icon={<BladesIcon />}
          skill="WS"
          weapons={weapons.filter((w) => w.type === 'melee')}
          ruleFor={(id) => index?.weaponKeywords[id]}
        />
        <p className="ds-tip">Tap a red ability to open its rule.</p>
      </div>

      {datasheet && datasheet.abilities.length > 0 && (
        <section className="abilities" data-tutorial-id="abilities">
          <h4 className="bar">Abilities</h4>
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
                  {a.type && <span className="ds-type">{a.type.toUpperCase()}: </span>}
                  <b>{title}</b> {a.parameter && <span className="muted">{a.parameter}</span>}
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

      {datasheet && datasheet.composition.length > 0 && (
        <section className="composition">
          <h4 className="bar">Unit composition</h4>
          {datasheet.composition.map((c) => (
            <RuleHtml key={c.line} html={c.html} onRuleLink={openRule} className="small" />
          ))}
        </section>
      )}

      <footer className="ds-keys keywords" data-tutorial-id="keywords">
        <div className="ds-kw">
          <span className="ds-kw-label">Keywords:</span>{' '}
          {unitKeywords.map((k) => (
            <KeywordChip key={k} label={k} ruleId={unitRule(k)} />
          ))}
        </div>
        {(factionKeywords.length > 0 || faction) && (
          <div className="ds-faction">
            <span className="ds-diamond">
              <span>{(faction?.id ?? factionKeywords[0] ?? '?').slice(0, 3).toUpperCase()}</span>
            </span>
            <span>
              Faction keywords:
              <br />
              {(factionKeywords.length > 0 ? factionKeywords : [faction?.name ?? '']).join(', ')}
            </span>
          </div>
        )}
      </footer>
    </article>
  );
}
