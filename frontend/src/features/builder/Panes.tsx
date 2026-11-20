import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelGroupHandle,
  type ImperativePanelHandle,
} from 'react-resizable-panels';
import { useBuilderUi } from './store';
import { DEFAULT_PANES, readLocalPanes, usePrefs, useSavePrefs, validPanes, writeLocalPanes } from './prefs';
import styles from './builder.module.css';

const MIN_PX = [220, 420, 300];
const RAIL_PX = 40;

type PaneDef = { id: string; title: string; content: ReactNode };

/**
 * The three resizable panes (DESIGN.md 7.2): minimum widths in pixels, double-click a handle to
 * reset, collapse a side pane to a thin rail, sizes saved in user prefs (and localStorage as cache).
 */
export function Panes({ add, list, details }: { add: ReactNode; list: ReactNode; details: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const group = useRef<ImperativePanelGroupHandle>(null);
  const addRef = useRef<ImperativePanelHandle>(null);
  const detailsRef = useRef<ImperativePanelHandle>(null);
  const [width, setWidth] = useState(1280);
  const prefs = usePrefs();
  const savePrefs = useSavePrefs();
  const [initial] = useState(() => readLocalPanes() ?? DEFAULT_PANES);
  const appliedServer = useRef(false);
  const [collapsed, setCollapsed] = useState<{ add: boolean; details: boolean }>({ add: false, details: false });
  // Collapse events from a container that has not been laid out yet (width 0) are not real.
  const laidOut = () => (container.current?.getBoundingClientRect().width ?? 0) > 0;
  const setPane = (which: 'add' | 'details', value: boolean) => {
    if (value && !laidOut()) return;
    setCollapsed((c) => ({ ...c, [which]: value }));
  };

  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width || 1280);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setWidth(e.contentRect.width || 1280));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Server prefs win over the local cache once they arrive (another device may have changed them).
  useEffect(() => {
    const server = prefs.data?.panes;
    if (appliedServer.current || !validPanes(server)) return;
    appliedServer.current = true;
    if (server.join() !== initial.join()) group.current?.setLayout(server);
  }, [prefs.data, initial]);

  // Selecting a unit opens the Details pane if it was collapsed.
  const selection = useBuilderUi((s) => s.selection);
  useEffect(() => {
    if (!selection || !laidOut()) return;
    try {
      if (detailsRef.current?.isCollapsed()) detailsRef.current.expand();
    } catch {
      // Layout not measured yet; nothing to expand.
    }
  }, [selection]);

  const pct = (px: number) => Math.min(45, (px / Math.max(width, 1)) * 100);
  const rail = pct(RAIL_PX);

  function onLayout(sizes: number[]) {
    writeLocalPanes(sizes);
    if (appliedServer.current || !prefs.isPending) savePrefs({ panes: sizes.map((s) => Math.round(s * 10) / 10) });
  }

  const defs: PaneDef[] = [
    { id: 'add', title: 'Add units', content: add },
    { id: 'list', title: 'List', content: list },
    { id: 'details', title: 'Details', content: details },
  ];

  function reset() {
    group.current?.setLayout(DEFAULT_PANES);
  }

  function toggle(which: 'add' | 'details') {
    const ref = which === 'add' ? addRef : detailsRef;
    if (ref.current?.isCollapsed()) ref.current.expand();
    else ref.current?.collapse();
  }

  return (
    <div ref={container} className={styles.panes}>
      <PanelGroup direction="horizontal" ref={group} onLayout={onLayout} id="builder-panes">
        <Panel
          ref={addRef}
          id="pane-add"
          order={1}
          defaultSize={initial[0]}
          minSize={pct(MIN_PX[0] ?? 220)}
          collapsible
          collapsedSize={rail}
          onCollapse={() => setPane('add', true)}
          onExpand={() => setPane('add', false)}
          className={styles.sidePane ?? ''}
        >
          {collapsed.add && <Rail title={defs[0]?.title ?? ''} onExpand={() => toggle('add')} />}
          <PaneFrame title={defs[0]?.title ?? ''} onCollapse={() => toggle('add')} hidden={collapsed.add}>
            {add}
          </PaneFrame>
        </Panel>
        <Handle onReset={reset} label="Resize Add units and List" />
        <Panel id="pane-list" order={2} defaultSize={initial[1]} minSize={pct(MIN_PX[1] ?? 420)} className={styles.listPane ?? ''}>
          {list}
        </Panel>
        <Handle onReset={reset} label="Resize List and Details" />
        <Panel
          ref={detailsRef}
          id="pane-details"
          order={3}
          defaultSize={initial[2]}
          minSize={pct(MIN_PX[2] ?? 300)}
          collapsible
          collapsedSize={rail}
          onCollapse={() => setPane('details', true)}
          onExpand={() => setPane('details', false)}
          className={styles.sidePane ?? ''}
        >
          {collapsed.details && <Rail title={defs[2]?.title ?? ''} onExpand={() => toggle('details')} />}
          <PaneFrame title={defs[2]?.title ?? ''} onCollapse={() => toggle('details')} side="right" hidden={collapsed.details}>
            {details}
          </PaneFrame>
        </Panel>
      </PanelGroup>
    </div>
  );
}

function Handle({ onReset, label }: { onReset: () => void; label: string }) {
  return (
    <PanelResizeHandle className={styles.handle ?? ''} title={`${label} (double-click to reset)`}>
      <div className={styles.handleHit} onDoubleClick={onReset} />
    </PanelResizeHandle>
  );
}

/** Pane content stays mounted while collapsed, so search text and scroll position survive. */
function PaneFrame({
  title,
  onCollapse,
  children,
  side = 'left',
  hidden = false,
}: {
  title: string;
  onCollapse: () => void;
  children: ReactNode;
  side?: 'left' | 'right';
  hidden?: boolean;
}) {
  return (
    <section className={styles.paneFrame} aria-label={title} hidden={hidden}>
      <div className={styles.paneBar}>
        <h2 className={styles.paneTitle}>{title}</h2>
        <button type="button" className={styles.iconBtn} onClick={onCollapse} aria-label={`Collapse ${title}`}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d={side === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
          </svg>
        </button>
      </div>
      <div className={styles.paneBody}>{children}</div>
    </section>
  );
}

function Rail({ title, onExpand }: { title: string; onExpand: () => void }) {
  return (
    <button type="button" className={styles.rail} onClick={onExpand} aria-label={`Expand ${title}`}>
      <span className={styles.railText}>{title}</span>
    </button>
  );
}
