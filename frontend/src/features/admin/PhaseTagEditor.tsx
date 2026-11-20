import type { Phase, PhaseTags, Timing } from '../../api/gameTypes';
import styles from './Admin.module.css';

export const PHASES: Phase[] = ['COMMAND', 'MOVEMENT', 'SHOOTING', 'CHARGE', 'FIGHT', 'ANY'];
export const TIMINGS: Timing[] = ['YOUR_TURN', 'OPPONENT_TURN', 'EITHER_TURN', 'PRE_GAME', 'ANY'];

export function label(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function PhaseTagEditor({ value, onChange, idPrefix }: { value: PhaseTags; onChange: (t: PhaseTags) => void; idPrefix: string }) {
  function toggle(p: Phase) {
    const has = value.phases.includes(p);
    const phases = has ? value.phases.filter((x) => x !== p) : [...value.phases, p];
    onChange({ ...value, phases: PHASES.filter((x) => phases.includes(x)) });
  }
  return (
    <div className={styles.tagEditor}>
      <fieldset className={styles.fieldset}>
        <legend className="sr-only">Phases</legend>
        {PHASES.map((p) => (
          <label key={p} className={`${styles.chipToggle} ${value.phases.includes(p) ? styles.chipOn : ''}`}>
            <input type="checkbox" className="sr-only" checked={value.phases.includes(p)} onChange={() => toggle(p)} />
            {label(p)}
          </label>
        ))}
      </fieldset>
      <label className={styles.inline} htmlFor={`${idPrefix}-timing`}>
        Timing
        <select
          id={`${idPrefix}-timing`}
          className={styles.select}
          value={value.timing}
          onChange={(e) => onChange({ ...value, timing: e.target.value as Timing })}
        >
          {TIMINGS.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
