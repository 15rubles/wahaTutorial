import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { KeywordContext, type OpenKeyword } from '../../components/rules/KeywordContext';
import { useIsMobile } from '../../lib/useMediaQuery';
import { KeywordPopup } from './KeywordPopup';
import { pop, push, truncate, type PopupEntry } from './stack';
import styles from './keywords.module.css';

/**
 * Makes every keyword clickable inside it (DESIGN.md 8). A click on a keyword outside the popup starts
 * a new stack; a click inside the popup pushes onto it. Desktop: floating panel near the click.
 * Mobile: bottom sheet that can be dragged up to full height. Esc closes everything.
 */
export function KeywordPopupProvider({ version, children }: { version?: number | undefined; children: ReactNode }) {
  const [stack, setStack] = useState<PopupEntry[]>([]);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mobile = useIsMobile();

  const open: OpenKeyword = useCallback((id, label, el) => {
    const inside = !!el && !!panel.current?.contains(el);
    if (inside) {
      setStack((s) => push(s, { id, label }));
      return;
    }
    returnFocus.current = el ?? null;
    setAnchor(el ? el.getBoundingClientRect() : null);
    setStack([{ id, label }]);
  }, []);

  const close = useCallback(() => {
    setStack([]);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (stack.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (panel.current && t && !panel.current.contains(t) && !(t instanceof Element && t.closest('[aria-haspopup="dialog"]'))) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [stack.length, close]);

  useEffect(() => {
    if (stack.length > 0) panel.current?.focus();
  }, [stack]);

  const current = stack[stack.length - 1];
  return (
    <KeywordContext.Provider value={open}>
      {children}
      {current && (
        <Positioned anchor={anchor} mobile={mobile} panelRef={panel}>
          <KeywordPopup
            key={`${stack.length}-${current.id ?? current.label}`}
            entry={current}
            stack={stack}
            version={version}
            onBack={() => setStack((s) => pop(s))}
            onCrumb={(i) => setStack((s) => truncate(s, i))}
            onClose={close}
          />
        </Positioned>
      )}
    </KeywordContext.Provider>
  );
}

const WIDTH = 420;
const GAP = 8;

function Positioned({
  anchor,
  mobile,
  panelRef,
  children,
}: {
  anchor: DOMRect | null;
  mobile: boolean;
  panelRef: React.RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number }>({ left: 16, top: 80, maxHeight: 480 });
  const [height, setHeight] = useState<'half' | 'full'>('half');
  const drag = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (mobile || typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const a = anchor ?? new DOMRect(vw / 2 - WIDTH / 2, 80, WIDTH, 0);
    const left = Math.min(Math.max(GAP, a.left), Math.max(GAP, vw - WIDTH - GAP));
    const below = vh - a.bottom - GAP * 2;
    const above = a.top - GAP * 2;
    const placeBelow = below >= 260 || below >= above;
    const maxHeight = Math.max(200, Math.min(560, placeBelow ? below : above));
    const top = placeBelow ? a.bottom + GAP : Math.max(GAP, a.top - GAP - maxHeight);
    setPos({ left, top, maxHeight });
  }, [anchor, mobile]);

  if (mobile) {
    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-label="Rules"
        className={`${styles.sheet} ${height === 'full' ? styles.sheetFull : ''}`}
      >
        <button
          type="button"
          className={styles.grabber}
          aria-label={height === 'full' ? 'Shrink rules panel' : 'Expand rules panel'}
          onClick={() => setHeight(height === 'full' ? 'half' : 'full')}
          onPointerDown={(e) => {
            drag.current = e.clientY;
          }}
          onPointerUp={(e) => {
            if (drag.current === null) return;
            const dy = e.clientY - drag.current;
            drag.current = null;
            if (dy < -40) setHeight('full');
            if (dy > 40) setHeight('half');
          }}
        >
          <span className={styles.grabberBar} />
        </button>
        {children}
      </div>
    );
  }
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-label="Rules"
      className={styles.popover}
      style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight, width: WIDTH }}
    >
      {children}
    </div>
  );
}
