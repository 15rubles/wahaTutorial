import type { Ability, DatasheetDetail, KeywordRef, StatProfile, Weapon } from '../../api/gameTypes';
import { MissingData } from '../ui/States';
import { KeywordRefButton } from './KeywordRefButton';
import { PhaseTagChip } from './PhaseTagChip';
import { RulesTextView } from './RulesTextView';
import styles from './rules.module.css';

const STATS: [keyof StatProfile, string][] = [
  ['m', 'M'],
  ['t', 'T'],
  ['sv', 'SV'],
  ['w', 'W'],
  ['ld', 'LD'],
  ['oc', 'OC'],
];

export function keywordId(term: string): string {
  return (
    'g:' +
    term
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/['’‘`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

export function KeywordChips({ keywords, factionKeywords }: { keywords: string[]; factionKeywords: string[] }) {
  return (
    <div className={styles.chips} aria-label="Keywords">
      {keywords.map((k) => (
        <KeywordRefButton key={`k-${k}`} glossaryId={keywordId(k)} label={k.toUpperCase()} />
      ))}
      {factionKeywords.map((k) => (
        <KeywordRefButton key={`f-${k}`} glossaryId={keywordId(k)} label={k.toUpperCase()} tone="plain" />
      ))}
    </div>
  );
}

export function StatGrid({ profiles }: { profiles: StatProfile[] }) {
  if (profiles.length === 0) return <MissingData what="model profile" />;
  return (
    <div className={styles.profiles}>
      {profiles.map((p) => (
        <div key={p.name} className={styles.profile}>
          {profiles.length > 1 && <span className={styles.profileName}>{p.name}</span>}
          <div className={styles.statGrid}>
            {STATS.map(([key, label]) => (
              <div key={key} className={styles.stat}>
                <span className={styles.statLabel}>{label}</span>
                <span className={`${styles.statValue} num`}>{String(p[key] ?? '') || '-'}</span>
              </div>
            ))}
          </div>
          {p.invuln && (
            <span className={styles.invuln}>
              Invulnerable save <span className="num">{p.invuln}</span>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function WeaponKeywords({ refs }: { refs: KeywordRef[] }) {
  if (refs.length === 0) return null;
  return (
    <span className={styles.weaponKeywords}>
      {refs.map((r, i) => (
        <span key={i}>
          {i > 0 && ', '}
          <KeywordRefButton glossaryId={r.glossaryId} label={r.label} inline />
        </span>
      ))}
    </span>
  );
}

export function WeaponsTable({ weapons }: { weapons: Weapon[] }) {
  if (weapons.length === 0) return null;
  const ranged = weapons.filter((w) => w.weaponType === 'RANGED');
  const melee = weapons.filter((w) => w.weaponType === 'MELEE');
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Weapon</th>
            <th>Range</th>
            <th>A</th>
            <th>BS/WS</th>
            <th>S</th>
            <th>AP</th>
            <th>D</th>
          </tr>
        </thead>
        <tbody>
          {[...ranged, ...melee].map((w) => (
            <tr key={w.key}>
              <td className={styles.weaponName}>
                {w.name}
                <WeaponKeywords refs={w.abilities} />
              </td>
              <td className="num">{w.range || '-'}</td>
              <td className="num">{w.a || '-'}</td>
              <td className="num">{w.skill || '-'}</td>
              <td className="num">{w.s || '-'}</td>
              <td className="num">{w.ap || '-'}</td>
              <td className="num">{w.d || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AbilityList({ abilities }: { abilities: Ability[] }) {
  if (abilities.length === 0) return null;
  return (
    <div className={styles.abilities}>
      {abilities.map((a) => (
        <div key={a.key} className={styles.ability}>
          <div className={styles.abilityHead}>
            {a.glossaryId ? <KeywordRefButton glossaryId={a.glossaryId} label={a.name} inline /> : <strong>{a.name}</strong>}
            <PhaseTagChip tags={a.tags} />
          </div>
          <RulesTextView text={a.text} />
        </div>
      ))}
    </div>
  );
}

/** Full datasheet: keywords, stats, weapons, abilities. */
export function DatasheetView({ detail }: { detail: DatasheetDetail }) {
  const d = detail.datasheet;
  return (
    <div className={styles.sheet}>
      <KeywordChips keywords={d.keywords} factionKeywords={d.factionKeywords} />
      <StatGrid profiles={d.profiles} />
      {detail.weapons.length > 0 && (
        <section>
          <h3 className={styles.h}>Weapons</h3>
          <WeaponsTable weapons={detail.weapons} />
        </section>
      )}
      {detail.abilities.length > 0 && (
        <section>
          <h3 className={styles.h}>Abilities</h3>
          <AbilityList abilities={detail.abilities} />
        </section>
      )}
      {d.composition && (
        <section>
          <h3 className={styles.h}>Unit composition</h3>
          <p className={styles.plain}>{d.composition}</p>
        </section>
      )}
      {d.loadout && (
        <section>
          <h3 className={styles.h}>Wargear</h3>
          <p className={styles.plain}>{d.loadout}</p>
        </section>
      )}
    </div>
  );
}
