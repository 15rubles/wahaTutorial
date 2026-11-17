import { type UnitState } from '@battle-drill/engine';
import {
  LESSONS,
  actionAllowed,
  buildLessonGame,
  currentStep,
  lessonById,
} from '@battle-drill/tutorial';
import { useEffect, useMemo } from 'react';
import { useArmy } from '../army/store.js';
import { ArmyRulesPanel } from '../components/ArmyRulesPanel.js';
import { GameView } from '../components/GameView.js';
import { StratagemPanel } from '../components/StratagemPanel.js';
import { useData } from '../data/store.js';
import { armyUnits } from '../game/buildGame.js';
import { useRulePopup } from '../game/rulePopup.js';
import { onGameNotice, useGame } from '../game/store.js';
import { href } from '../router.js';
import { TutorialOverlay } from '../tutorial/Overlay.js';
import { useTutorial } from '../tutorial/store.js';

function useArmyUnits(): { units: UnitState[]; attached: UnitState[]; ready: boolean } {
  const army = useArmy((s) => s.army);
  const hydrate = useArmy((s) => s.hydrate);
  const { datasheets, game } = useData();
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return useMemo(() => {
    if (!army) return { units: [], attached: [], ready: true };
    const ready = army.units.every((u) => datasheets.has(u.datasheetId));
    if (!ready) return { units: [], attached: [], ready };
    const ds = (id: string) => datasheets.get(id);
    const ab = (id: string) => game?.abilities.find((a) => a.id === id)?.name;
    return {
      units: armyUnits(army, ds, ab),
      attached: armyUnits(army, ds, ab, { attached: true }),
      ready,
    };
  }, [army, datasheets, game]);
}

export function LessonList() {
  const progress = useTutorial((s) => s.progress);
  const army = useArmy((s) => s.army);
  return (
    <section>
      <h2>Lessons</h2>
      <p className="muted">
        Each lesson uses{' '}
        {army
          ? `units from ${army.name}`
          : 'invented stand-in units (import your army to use your own)'}{' '}
        and adds one layer of the rules.
      </p>
      <ol className="lesson-list">
        {LESSONS.map((l) => (
          <li key={l.id}>
            <a href={href('learn', l.id)} data-testid={`lesson-${l.id}`}>
              {l.title}
            </a>
            {progress.completed.includes(l.id) && <span className="tag">done</span>}
            <div className="small muted">{l.summary}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LessonPage({ lessonId }: { lessonId: string }) {
  const lesson = lessonById(lessonId);
  const { units, attached, ready } = useArmyUnits();
  const { history, start, setGuard, setDice, select } = useGame();
  const tutorial = useTutorial();

  // Build the lesson game once the army's datasheets are loaded.
  useEffect(() => {
    if (!lesson || !ready) return;
    const { state, ctx } = buildLessonGame(lesson, units, attached);
    start(state);
    const resume =
      tutorial.progress.current?.lessonId === lesson.id ? tutorial.progress.current.stepIndex : 0;
    tutorial.begin(
      lesson,
      ctx,
      resume > 0 && !tutorial.progress.completed.includes(lesson.id) ? resume : 0,
    );
    return () => {
      setGuard(null);
      setDice(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, ready]);

  const runner = tutorial.runner;
  const step = lesson && runner ? currentStep(lesson, runner) : undefined;

  // Per step: block actions the step does not allow, force dice, run setup.
  useEffect(() => {
    if (!step) {
      setGuard(null);
      setDice(null);
      return;
    }
    setGuard((action) => actionAllowed(step, action));
    setDice(step.dice ?? null);
    if (step.setup && tutorial.ctx) {
      const s = useGame.getState().history?.current;
      if (s) start(step.setup(s, tutorial.ctx));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // Feed engine results and UI signals to the step runner.
  useEffect(() => {
    const off = onGameNotice((n) => {
      if (n.kind === 'applied')
        tutorial.input({ type: 'events', events: n.events, state: n.state });
      if (n.kind === 'rejected') tutorial.input({ type: 'rejected', code: n.error.code });
      if (n.kind === 'blocked') tutorial.input({ type: 'blocked', action: n.action });
    });
    const offSel = useGame.subscribe((s, prev) => {
      if (s.selectedUnitId && s.selectedUnitId !== prev.selectedUnitId)
        tutorial.input({ type: 'ui', signal: { type: 'unit-selected', unitId: s.selectedUnitId } });
    });
    const offRule = useRulePopup.subscribe((s, prev) => {
      if (s.ruleId && s.ruleId !== prev.ruleId)
        tutorial.input({ type: 'ui', signal: { type: 'rule-opened', ruleId: s.ruleId } });
    });
    return () => {
      off();
      offSel();
      offRule();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => select(null), [select]);

  if (!lesson) return <p>Unknown lesson.</p>;
  if (!ready || !history) return <p className="muted">Preparing the lesson...</p>;
  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  return (
    <section className="sandbox lesson">
      <GameView
        state={history.current}
        extra={
          <>
            {lesson.panels?.includes('stratagems') && <StratagemPanel state={history.current} />}
            {lesson.panels?.includes('army-rules') && <ArmyRulesPanel />}
          </>
        }
      />
      <TutorialOverlay nextLessonId={LESSONS[idx + 1]?.id} />
    </section>
  );
}
