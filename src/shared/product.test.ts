import { describe, expect, it } from 'vitest';

import { PRODUCT } from './product';

describe('PRODUCT', () => {
  it('keeps the public Tynly identity centralized', () => {
    expect(PRODUCT.name).toBe('Tynly');
    expect(PRODUCT.tagline).toBe('Type anything. Send naturally.');
  });
});
