import { useEffect, useState } from 'react';
import type { EntityType, PhaseTags } from '../../api/gameTypes';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { useFactions } from '../game/api';
import { useConfirmPhaseTags, usePhaseReview, type ReviewItem, type ReviewState } from './dataApi';
import { PhaseTagEditor, label } from './PhaseTagEditor';
import styles from './Admin.module.css';

const PAGE = 25;

export function ReviewPage() {
  const factions = useFactions();
  const [faction, setFaction] = useState('');
  const [type, setType] = useState<EntityType | ''>('');
  const [state, setState] = useState<ReviewState>('inferred');
  const [offset, setOffset] = useState(0);
  const page = usePhaseReview({ ...(faction ? { faction } : {}), ...(type ? { type } : {}), state, offset });
  const confirm = useConfirmPhaseTags();
  const [edits, setEdits] = useState<Record<string, PhaseTags>>({});

  useEffect(() => setEdits({}), [page.data]);

  const items = page.data?.items ?? [];
  const tagsOf = (i: ReviewItem) => edits[i.key] ?? i.tags;

  return (
    <section className={styles.section} aria-labelledby="review-h">
      <h2 id="review-h" className={styles.sectionTitle}>
        Phase tag review
      </h2>
      <p className={styles.muted}>
        Tags guessed from the rules text (or missing). Fix them if needed and confirm; confirmed tags are kept across
        imports.
      </p>
      <div className={styles.toolbar}>
        <label className={styles.inline}>
          Faction
          <select className={styles.select} value={faction} onChange={(e) => { setFaction(e.target.value); setOffset(0); }}>
            <option value="">all</option>
            {factions.data?.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inline}>
          Type
          <select className={styles.select} value={type} onChange={(e) => { setType(e.target.value as EntityType | ''); setOffset(0); }}>
            <option value="">all</option>
            <option value="STRATAGEM">stratagems</option>
            <option value="ENHANCEMENT">enhancements</option>
            <option value="ABILITY">abilities</option>
          </select>
        </label>
        <label className={styles.inline}>
          Show
          <select className={styles.select} value={state} onChange={(e) => { setState(e.target.value as ReviewState); setOffset(0); }}>
            <option value="inferred">inferred</option>
            <option value="empty">no tags</option>
            <option value="all">both</option>
          </select>
        </label>
      </div>
      {confirm.isError && <Notice>{errorMessage(confirm.error)}</Notice>}
      {page.isPending && <LoadingState />}
      {page.isError && <ErrorState error={page.error} />}
      {page.data && (
        <>
          <div className={styles.headRow}>
            <span className={styles.muted}>
              <span className="num">{page.data.total}</span> to review
            </span>
            <Button
              variant="primary"
              size="s"
              disabled={items.length === 0 || confirm.isPending}
              onClick={() => confirm.mutate(items.map((i) => ({ type: i.type, key: i.key, tags: tagsOf(i) })))}
            >
              Confirm all on this page
            </Button>
          </div>
          <ul className={styles.reviewList}>
            {items.map((i) => (
              <li key={i.key} className={styles.reviewItem}>
                <div className={styles.reviewHead}>
                  <strong>{i.name}</strong>
                  <span className={styles.key}>
                    {label(i.type)} {i.faction ? `[${i.faction}]` : ''}
                  </span>
                  {i.tags.inferred && <span className={`${styles.status} ${styles.lv_WARNING}`}>inferred</span>}
                </div>
                <p className={styles.reviewText}>{i.text || '(no text)'}</p>
                <div className={styles.toolbar}>
                  <PhaseTagEditor idPrefix={i.key} value={tagsOf(i)} onChange={(t) => setEdits((e) => ({ ...e, [i.key]: t }))} />
                  <Button size="s" disabled={confirm.isPending} onClick={() => confirm.mutate([{ type: i.type, key: i.key, tags: tagsOf(i) }])}>
                    Confirm
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.toolbar}>
            <Button size="s" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Previous
            </Button>
            <Button size="s" disabled={offset + PAGE >= page.data.total} onClick={() => setOffset(offset + PAGE)}>
              Next
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
