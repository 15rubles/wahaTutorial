import { createEmptyGameState } from '@battle-drill/engine';
import { describe, expect, it } from 'vitest';
import { lessonStepIds, type Lesson } from './index.js';

const demo: Lesson = {
  id: 'demo',
  title: 'Demo',
  steps: [
    { id: 'hello', ruleRefs: [], say: 'Welcome to the drill.' },
    {
      id: 'setup',
      ruleRefs: ['example.rule-id'],
      say: 'Now we set up the board.',
      setup: (s) => s,
    },
  ],
};

describe('tutorial skeleton', () => {
  it('lists step ids in order', () => {
    expect(lessonStepIds(demo)).toEqual(['hello', 'setup']);
  });

  it('can run a step setup against an engine state', () => {
    const state = createEmptyGameState();
    expect(demo.steps[1]?.setup?.(state)).toBe(state);
  });
});
