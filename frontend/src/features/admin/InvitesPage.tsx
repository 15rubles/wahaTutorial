import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ErrorState, LoadingState, Notice, errorMessage } from '../../components/ui/States';
import { formatDateTime } from '../../lib/format';
import { useCreateInvite, useInvites, type Invite } from './api';
import styles from './Admin.module.css';

function inviteLink(code: string): string {
  return `${window.location.origin}/register?invite=${encodeURIComponent(code)}`;
}

export function InvitesPage() {
  const invites = useInvites();
  const create = useCreateInvite();
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(code);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="invites-h">
      <h2 id="invites-h" className={styles.sectionTitle}>
        Invite codes
      </h2>
      <p className={styles.muted}>Each code works once. Send the link to a friend so they can register.</p>
      <div className={styles.toolbar}>
        <label className={styles.inline}>
          Valid for
          <select className={styles.select} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 3, 7, 14, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} day{d === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <Button variant="primary" onClick={() => create.mutate(days)} disabled={create.isPending}>
          Create invite
        </Button>
      </div>
      {create.isError && <Notice>{errorMessage(create.error)}</Notice>}
      {create.data && (
        <Notice tone="ok">
          New code <strong className="num">{create.data.code}</strong>
        </Notice>
      )}
      {invites.isPending && <LoadingState />}
      {invites.isError && <ErrorState error={invites.error} />}
      {invites.data && invites.data.length === 0 && <p className={styles.muted}>No invite codes yet.</p>}
      {invites.data && invites.data.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Used by</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {invites.data.map((i: Invite) => (
                <tr key={i.id}>
                  <td className="num">{i.code}</td>
                  <td>
                    <span className={`${styles.status} ${styles[`st_${i.status}`]}`}>{i.status.toLowerCase()}</span>
                  </td>
                  <td>{formatDateTime(i.expiresAt)}</td>
                  <td>{i.usedBy ?? '-'}</td>
                  <td>
                    {i.status === 'ACTIVE' && (
                      <Button size="s" onClick={() => void copy(i.code)}>
                        {copied === i.code ? 'Link copied' : 'Copy link'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
