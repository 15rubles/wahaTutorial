import type { PhaseTags } from '../../api/gameTypes';
import styles from './rules.module.css';

const PHASE: Record<string, string> = {
  COMMAND: 'Command',
  MOVEMENT: 'Movement',
  SHOOTING: 'Shooting',
  CHARGE: 'Charge',
  FIGHT: 'Fight',
  ANY: 'Any phase',
};
const TIMING: Record<string, string> = {
  YOUR_TURN: 'your turn',
  OPPONENT_TURN: "opponent's turn",
  EITHER_TURN: 'either turn',
  PRE_GAME: 'before the battle',
  ANY: '',
};

export function phaseLabel(tags: PhaseTags): string {
  if (tags.timing === 'PRE_GAME') return 'Before the battle';
  const phases = tags.phases.map((p) => PHASE[p] ?? p).join(' / ');
  const timing = TIMING[tags.timing] ?? '';
  return [phases, timing].filter(Boolean).join(' · ');
}

/** "Shooting · your turn". Inferred tags get a small dot so they can be double-checked. */
export function PhaseTagChip({ tags }: { tags: PhaseTags }) {
  if (tags.phases.length === 0 && tags.timing !== 'PRE_GAME') return null;
  const tone = tags.phases.includes('FIGHT') || tags.phases.includes('CHARGE') ? styles.tagPeach : styles.tagSage;
  return (
    <span className={`${styles.tag} ${tone}`} title={tags.inferred && !tags.confirmed ? 'Phase guessed from the rules text' : undefined}>
      {phaseLabel(tags)}
      {tags.inferred && !tags.confirmed && <span className={styles.inferredDot} aria-label="inferred" />}
    </span>
  );
}
