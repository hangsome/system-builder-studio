import { describe, expect, it } from 'vitest';
import { normalizeFeatureMode, resolveBooleanFlag } from './featureMode';

describe('featureMode', () => {
  it('normalizes supported feature modes', () => {
    expect(normalizeFeatureMode('teaching')).toBe('teaching');
    expect(normalizeFeatureMode('COMMERCIAL')).toBe('commercial');
    expect(normalizeFeatureMode(' full ')).toBe('full');
  });

  it('falls back to commercial for unknown modes', () => {
    expect(normalizeFeatureMode(undefined)).toBe('commercial');
    expect(normalizeFeatureMode('openclass')).toBe('commercial');
  });

  it('resolves optional boolean flags', () => {
    expect(resolveBooleanFlag(undefined, true)).toBe(true);
    expect(resolveBooleanFlag('', false)).toBe(false);
    expect(resolveBooleanFlag('true', false)).toBe(true);
    expect(resolveBooleanFlag('1', false)).toBe(true);
    expect(resolveBooleanFlag('false', true)).toBe(false);
    expect(resolveBooleanFlag('off', true)).toBe(false);
  });
});
