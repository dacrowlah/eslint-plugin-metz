import { describe, expect, it } from 'vitest';
import { thrownBy } from './thrown.ts';

// Self-test of thrownBy: it hands back exactly what was thrown, and fails when nothing was.
describe('thrownBy', () => {
  it('returns the error the call throws, unchanged', () => {
    const error = new RangeError('too far');
    expect(
      thrownBy(() => {
        throw error;
      }),
    ).toBe(error);
  });
  it('fails when the call returns', () => {
    const returns = (): number => 1;
    expect(() => thrownBy(returns)).toThrow(/^expected the call to throw, but it returned$/);
  });
});
