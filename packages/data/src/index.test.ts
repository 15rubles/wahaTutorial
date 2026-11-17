import { describe, expect, it } from 'vitest';
import { DATA_CACHE_DIR, DATA_PACKAGE_VERSION } from './index.js';

describe('data package skeleton', () => {
  it('exposes a version and the cache dir', () => {
    expect(DATA_PACKAGE_VERSION).toBe('0.0.0');
    expect(DATA_CACHE_DIR).toBe('data-cache');
  });
});
