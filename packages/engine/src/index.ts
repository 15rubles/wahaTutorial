/**
 * Pure rules engine. No UI, no DOM, no network.
 * Game state is an immutable, JSON-serializable plain object.
 */

export interface GameState {
  readonly version: 1;
  readonly battleRound: number;
  readonly events: readonly EngineEvent[];
}

export interface EngineEvent {
  readonly type: string;
}

export function createEmptyGameState(): GameState {
  return Object.freeze({
    version: 1,
    battleRound: 0,
    events: Object.freeze([]),
  });
}
