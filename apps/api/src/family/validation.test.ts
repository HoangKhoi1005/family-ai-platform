import { describe, expect, it } from 'vitest';
import { BoundedRateLimiter, resolveExpiry } from './authorization.js';

describe('family route validation', () => {
  it('defaults invitations and claims to seven days and caps them at thirty days', () => {
    const before = Date.now();
    const expiry = resolveExpiry(undefined);
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 - 20);
    expect(expiry.getTime()).toBeLessThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 + 100);
    expect(() =>
      resolveExpiry(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()),
    ).toThrow('expires_at');
  });

  it('keeps the local rate limiter bounded while enforcing a window', () => {
    const limiter = new BoundedRateLimiter(2, 60_000, 2);
    expect(limiter.allow('actor-a')).toBe(true);
    expect(limiter.allow('actor-a')).toBe(true);
    expect(limiter.allow('actor-a')).toBe(false);
    expect(limiter.size).toBeLessThanOrEqual(2);
  });
});
