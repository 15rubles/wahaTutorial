import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from './index.js';

describe('createEmptyGameState', () => {
  it('is JSON-serializable without loss', () => {
    const state = createEmptyGameState();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('is frozen', () => {
    const state = createEmptyGameState();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.events)).toBe(true);
  });
});
