import { describe, expect, it } from 'vitest';

import { cx } from './cx';

describe('cx', () => {
  it('joins class names with a single space', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('skips falsy and empty values', () => {
    expect(cx('base', false, null, undefined, '', 'fin')).toBe('base fin');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cx(false, null, undefined)).toBe('');
  });
});
