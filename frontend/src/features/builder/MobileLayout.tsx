import type { ReactNode } from 'react';
import { useBuilderUi, type MobileTab } from './store';
import styles from './mobile.module.css';

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'add', label: 'Add' },
  { id: 'list', label: 'List' },
  { id: 'details', label: 'Details' },
];

/**
 * Mobile builder (DESIGN.md 7.3): one pane at a time with a bottom tab bar. All panes stay mounted so
 * search text and scroll positions survive tab switches.
 */
export function MobileLayout({ add, list, details }: { add: ReactNode; list: ReactNode; details: ReactNode }) {
  const tab = useBuilderUi((s) => s.mobileTab);
  const setTab = useBuilderUi((s) => s.setMobileTab);
  const content: Record<MobileTab, ReactNode> = { add, list, details };
  return (
    <div className={styles.mobile}>
      {TABS.map((t) => (
        <section
          key={t.id}
          id={`tabpanel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          aria-label={t.id === 'add' ? 'Add units' : t.id === 'list' ? 'List' : 'Details'}
          hidden={tab !== t.id}
          className={styles.panel}
        >
          {content[t.id]}
        </section>
      ))}
      <nav className={styles.tabBar} aria-label="Builder sections">
        <div role="tablist" className={styles.tabList}>
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              className={`${styles.tab} ${tab === t.id ? styles.tabOn : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
