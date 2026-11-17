import type { Point } from '../types.js';
import { type Polygon, rect } from './geometry.js';

export const ruleRefs = [
  'core.terrain.placing-terrain',
  'core.terrain.terrain-categories',
  'core.objectives',
];

export type TerrainCategory = 'exposed' | 'light' | 'dense';

export interface TerrainArea {
  readonly id: string;
  readonly name: string;
  readonly polygon: Polygon;
  /** Categories of the features in this area. */
  readonly categories: readonly TerrainCategory[];
}

export interface Objective {
  readonly id: string;
  readonly position: Point;
  /** Set when the objective is a terrain objective (14.01). */
  readonly terrainAreaId?: string;
}

export interface DeploymentZone {
  readonly player: 'p1' | 'p2';
  readonly polygon: Polygon;
}

export interface Battlefield {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly TerrainArea[];
  readonly objectives: readonly Objective[];
  readonly deploymentZones: readonly DeploymentZone[];
}

/** Obscuring: an area with one or more light or dense features (13.10). */
export const isObscuring = (t: TerrainArea): boolean =>
  t.categories.includes('light') || t.categories.includes('dense');

/** Objective marker: 40mm across (14.01.01). */
export const OBJECTIVE_MARKER_RADIUS = 20 / 25.4;
/** In range of an objective marker: within 3" (14.01.01). */
export const OBJECTIVE_RANGE = 3;

/** A small invented training ground used by tests and the sandbox. */
export function trainingGround(): Battlefield {
  return {
    width: 44,
    height: 30,
    terrain: [
      { id: 'ruin-west', name: 'Ruin', polygon: rect(10, 11, 5, 8), categories: ['dense'] },
      { id: 'wall-east', name: 'Low walls', polygon: rect(29, 6, 4, 3), categories: ['light'] },
      { id: 'crater', name: 'Craters', polygon: rect(28, 20, 5, 4), categories: ['exposed'] },
    ],
    objectives: [
      { id: 'obj-centre', position: { x: 22, y: 15 } },
      { id: 'obj-ruin', position: { x: 12.5, y: 15 }, terrainAreaId: 'ruin-west' },
      { id: 'obj-east', position: { x: 33, y: 15 } },
    ],
    deploymentZones: [
      { player: 'p1', polygon: rect(0, 0, 44, 6) },
      { player: 'p2', polygon: rect(0, 24, 44, 6) },
    ],
  };
}
