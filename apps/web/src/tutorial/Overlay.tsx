import { type UiTarget, currentStep, fillText } from '@battle-drill/tutorial';
import { useEffect, useState } from 'react';
import { RuleHtml } from '../components/RuleHtml.js';
import { useData } from '../data/store.js';
import { useRulePopup } from '../game/rulePopup.js';
import { href } from '../router.js';
import { useTutorial } from './store.js';

type Rect = { x: number; y: number; w: number; h: number };
const PAD = 6;

function selectorFor(
  t: UiTarget,
  units: Readonly<Record<string, string | undefined>>,
): string | null {
  if (t.kind === 'element') return `[data-tutorial-id="${t.id}"]`;
  const id = units[t.role];
  return id ? `[data-tutorial-id="unit-${id}"]` : null;
}

/** Spotlight: dims the page, cuts holes over the focused elements, blocks input everywhere else. */
export function TutorialOverlay({ nextLessonId }: { nextLessonId?: string | undefined }) {
  const { lesson, ctx, runner, input, exit } = useTutorial();
  const rules = useData((s) => s.rules);
  const openRule = useRulePopup((s) => s.open);
  const step = lesson && runner ? currentStep(lesson, runner) : undefined;
  const [rects, setRects] = useState<Rect[]>([]);
  const free = !!step?.free;
  const selectors =
    !free && step?.focus && ctx
      ? step.focus.map((f) => selectorFor(f, ctx.units)).filter((s): s is string => !!s)
      : [];
  const key = selectors.join('|');

  // Track focused elements (they move when the board re-renders or the page scrolls).
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const next: Rect[] = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 || r.height > 0)
            next.push({
              x: r.left - PAD,
              y: r.top - PAD,
              w: r.width + PAD * 2,
              h: r.height + PAD * 2,
            });
        });
      }
      setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      frame = window.setTimeout(measure, 200);
    };
    measure();
    return () => window.clearTimeout(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Block clicks and drags outside the focused elements, the tutorial box and the rule popup.
  useEffect(() => {
    if (!step || runner?.done || free) return;
    const allowedTargets = () => [
      ...selectors.flatMap((s) => [...document.querySelectorAll(s)]),
      ...document.querySelectorAll('[data-tutorial-box], dialog[open]'),
    ];
    const guard = (e: Event) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (allowedTargets().some((el) => el.contains(t))) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'click') input({ type: 'blocked', action: 'click' });
    };
    const types = ['pointerdown', 'mousedown', 'click'];
    types.forEach((ty) => document.addEventListener(ty, guard, true));
    return () => types.forEach((ty) => document.removeEventListener(ty, guard, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, step, runner?.done, input, free]);

  if (!lesson || !ctx || !runner) return null;
  const total = lesson.steps.length;
  const say = step ? fillText(step.say, ctx) : '';
  const hint = runner.hint ? fillText(runner.hint, ctx) : null;
  const needsNext = step && (!step.expect || step.expect.kind === 'ack');

  return (
    <>
      {!runner.done && !free && (
        <svg className="tutorial-dim" aria-hidden="true">
          <defs>
            <mask id="tutorial-holes">
              <rect width="100%" height="100%" fill="white" />
              {rects.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={8} fill="black" />
              ))}
            </mask>
          </defs>
          <rect width="100%" height="100%" mask="url(#tutorial-holes)" className="tutorial-shade" />
          {rects.map((r, i) => (
            <rect
              key={`o${i}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={8}
              className="tutorial-ring"
            />
          ))}
        </svg>
      )}
      <aside
        className="tutorial-box"
        data-tutorial-box
        data-testid="tutorial-box"
        aria-live="polite"
      >
        <header>
          <strong>{lesson.title}</strong>
          <span className="small muted" data-testid="tutorial-step">
            {runner.done ? 'Complete' : `Step ${runner.stepIndex + 1} of ${total}`}
          </span>
        </header>
        {runner.stepIndex === 0 && ctx.fallbacks.length > 0 && !runner.done && (
          <p className="small notice">
            Your army has no unit for: {ctx.fallbacks.join(', ')}. An invented stand-in plays that
            part in this lesson.
          </p>
        )}
        {runner.done ? (
          <>
            <p data-testid="tutorial-done">Lesson complete. Well done!</p>
            <div className="button-row">
              {nextLessonId && (
                <a className="button primary" href={href('learn', nextLessonId)}>
                  Next lesson
                </a>
              )}
              <a className="button" href={href('learn')} onClick={exit}>
                All lessons
              </a>
            </div>
          </>
        ) : (
          <>
            <p data-testid="tutorial-say">{say}</p>
            {hint && (
              <p className="tutorial-hint" role="alert" data-testid="tutorial-hint">
                {hint}
              </p>
            )}
            {step && step.ruleRefs.length > 0 && (
              <div className="tutorial-rules">
                {step.ruleRefs.map((id) => {
                  const section = rules?.byId.get(id);
                  if (!section) return null;
                  return (
                    <details key={id} open={runner.explainAgain}>
                      <summary>
                        Rule:{' '}
                        {section.number && <span className="rule-number">{section.number}</span>}{' '}
                        {section.title}
                      </summary>
                      <RuleHtml html={section.html} onRuleLink={openRule} />
                    </details>
                  );
                })}
              </div>
            )}
            <div className="button-row">
              {needsNext && (
                <button
                  type="button"
                  className="primary"
                  onClick={() => input({ type: 'ack' })}
                  data-testid="tutorial-next"
                >
                  Next
                </button>
              )}
              <button type="button" onClick={() => input({ type: 'explainAgain' })}>
                Explain again
              </button>
              <button
                type="button"
                onClick={() => input({ type: 'skip' })}
                data-testid="tutorial-skip"
              >
                Skip step
              </button>
              <a className="button" href={href('learn')} onClick={exit}>
                Exit
              </a>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
