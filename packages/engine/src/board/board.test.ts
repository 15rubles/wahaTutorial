import { describe, expect, it } from 'vitest';
import { model, unit } from '../testing.js';
import type { Point } from '../types.js';
import { type Battlefield, trainingGround } from './battlefield.js';
import { inCoherency } from './coherency.js';
import { pointInPolygon, rect, segmentCrossesPolygon, segmentsIntersect } from './geometry.js';
import { modelDistance, unitsEngaged } from './measure.js';
import { hasBenefitOfCover, modelFullyVisible, modelVisible } from './visibility.js';

const at = (id: string, p: Point, extra = {}) =>
  model(id, { position: p, baseRadius: 0.5, ...extra });

describe('geometry', () => {
  it('handles polygons and segments', () => {
    const sq = rect(0, 0, 2, 2);
    expect(pointInPolygon({ x: 1, y: 1 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 3, y: 1 }, sq)).toBe(false);
    expect(pointInPolygon({ x: 2, y: 1 }, sq)).toBe(true);
    expect(segmentsIntersect({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).toBe(
      true,
    );
    expect(segmentCrossesPolygon({ x: -1, y: 1 }, { x: 3, y: 1 }, sq)).toBe(true);
    expect(segmentCrossesPolygon({ x: -1, y: 3 }, { x: 3, y: 3 }, sq)).toBe(false);
  });
});

describe('measuring', () => {
  it('measures base edge to base edge and engagement at 2"', () => {
    const a = at('a', { x: 0, y: 0 });
    const b = at('b', { x: 3, y: 0 });
    expect(modelDistance(a, b)).toBeCloseTo(2);
    const ua = { ...unit('A', 0, {}, {}, 'p1'), models: [a] };
    const ub = { ...unit('B', 0), models: [b] };
    expect(unitsEngaged(ua, ub)).toBe(true);
    expect(unitsEngaged(ua, { ...ub, models: [at('b', { x: 3.1, y: 0 })] })).toBe(false);
  });

  it('checks coherency: 2" to one model and 9" to all', () => {
    const line = (gap: number, n: number) => ({
      ...unit('u', 0),
      models: Array.from({ length: n }, (_, i) => at(`m${i}`, { x: i * (1 + gap), y: 0 })),
    });
    expect(inCoherency(line(1.5, 5))).toBe(true);
    expect(inCoherency(line(2.5, 2))).toBe(false);
    expect(inCoherency(line(1.9, 5))).toBe(false); // ends more than 9" apart
  });
});

describe('visibility and cover', () => {
  const field: Battlefield = {
    ...trainingGround(),
    terrain: [{ id: 'block', name: 'Ruin', polygon: rect(4, -2, 2, 4), categories: ['dense'] }],
  };
  it('obscuring terrain blocks line of sight between models outside it', () => {
    expect(modelVisible(field, at('a', { x: 0, y: 0 }), at('b', { x: 10, y: 0 }))).toBe(false);
    expect(modelVisible(field, at('a', { x: 0, y: 5 }), at('b', { x: 10, y: 5 }))).toBe(true);
  });

  it('a model inside the area can see and be seen', () => {
    expect(modelVisible(field, at('a', { x: 0, y: 0 }), at('b', { x: 5, y: 0 }))).toBe(true);
  });

  it('partly hidden models are visible but not fully visible, which gives cover', () => {
    const observer = at('a', { x: 0, y: 2.4 });
    const target = at('b', { x: 10, y: 2.4 });
    expect(modelVisible(field, observer, target)).toBe(true);
    expect(modelFullyVisible(field, observer, target)).toBe(false);
    expect(hasBenefitOfCover(field, observer, { ...unit('T', 0), models: [target] })).toBe(true);
  });

  it('infantry inside a terrain area has cover; vehicles only if not fully visible', () => {
    const inside = at('b', { x: 5, y: 0 });
    expect(
      hasBenefitOfCover(field, at('a', { x: 5, y: 10 }), { ...unit('T', 0), models: [inside] }),
    ).toBe(true);
    expect(
      hasBenefitOfCover(field, at('a', { x: 5, y: 10 }), {
        ...unit('T', 0, { keywords: ['VEHICLE'] }),
        models: [inside],
      }),
    ).toBe(false);
  });
});
