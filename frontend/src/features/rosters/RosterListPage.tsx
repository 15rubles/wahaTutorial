import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { TextField } from '../../components/ui/TextField';
import { formatDateTime } from '../../lib/format';
import { useBattleSizes, useFactions } from '../game/api';
import { useCreateRoster, useDeleteRoster, useDuplicateRoster, useRosterList, type RosterSummary } from './api';
import styles from './RosterListPage.module.css';

export function RosterListPage() {
  const rosters = useRosterList();
  const [creating, setCreating] = useState(false);
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>My lists</h1>
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            New list
          </Button>
        )}
      </div>
      {creating && <NewListForm onCancel={() => setCreating(false)} />}
      {rosters.isPending && <LoadingState label="Loading your lists" />}
      {rosters.isError && <ErrorState error={rosters.error} />}
      {rosters.data && rosters.data.length === 0 && !creating && (
        <div className={styles.empty}>
          <p>You have no army lists yet.</p>
        </div>
      )}
      {rosters.data && rosters.data.length > 0 && (
        <ul className={styles.list}>
          {rosters.data.map((r) => (
            <RosterRow key={r.id} roster={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RosterRow({ roster }: { roster: RosterSummary }) {
  const duplicate = useDuplicateRoster();
  const remove = useDeleteRoster();
  const [confirming, setConfirming] = useState(false);
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <Link to={`/rosters/${roster.id}`} className={styles.name}>
          {roster.name}
        </Link>
        <span className={styles.meta}>
          {roster.factionName} · updated {formatDateTime(roster.updatedAt)}
        </span>
      </div>
      <span className={`${styles.points} num`}>{roster.points} pts</span>
      <span className={`${styles.pill} ${roster.legal ? styles.ok : styles.bad}`}>{roster.legal ? 'Legal' : 'Not legal'}</span>
      {roster.outdated && <span className={`${styles.pill} ${styles.info}`}>Older data</span>}
      <div className={styles.actions}>
        <Button size="s" onClick={() => duplicate.mutate(roster.id)} disabled={duplicate.isPending}>
          Duplicate
        </Button>
        {!confirming ? (
          <Button size="s" variant="danger" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        ) : (
          <>
            <Button size="s" variant="danger" onClick={() => remove.mutate(roster.id)} disabled={remove.isPending}>
              Delete {roster.name}?
            </Button>
            <Button size="s" variant="ghost" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function NewListForm({ onCancel }: { onCancel: () => void }) {
  const factions = useFactions();
  const sizes = useBattleSizes();
  const create = useCreateRoster();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [faction, setFaction] = useState('');
  const [size, setSize] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof factions.data>>();
    for (const f of factions.data ?? []) {
      const key = f.allegiance ? f.allegiance.charAt(0) + f.allegiance.slice(1).toLowerCase() : 'Other';
      map.set(key, [...(map.get(key) ?? []), f]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [factions.data]);

  const noData = factions.isError && factions.error instanceof ApiError && factions.error.code === 'NO_GAME_DATA';

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), factionKey: faction, ...(size ? { battleSizeKey: size } : {}) },
      { onSuccess: (view) => navigate(`/rosters/${view.id}`) },
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-labelledby="new-list-h">
      <h2 id="new-list-h" className={styles.formTitle}>
        New list
      </h2>
      {noData && <Notice>No game data has been activated yet. An admin needs to import data first.</Notice>}
      <TextField label="List name" name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      <label className={styles.field}>
        Faction
        <select className={styles.select} value={faction} onChange={(e) => setFaction(e.target.value)} required>
          <option value="">Choose a faction</option>
          {grouped.map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Battle size
        <select className={styles.select} value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="">Default (largest)</option>
          {sizes.data?.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name}
              {b.pointsLimit !== undefined ? ` (${b.pointsLimit} points)` : ''}
            </option>
          ))}
        </select>
      </label>
      {create.isError && <Notice>{errorMessage(create.error)}</Notice>}
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={!name.trim() || !faction || create.isPending}>
          Create list
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
