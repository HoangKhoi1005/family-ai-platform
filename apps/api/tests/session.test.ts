import { describe, expect, it, vi } from 'vitest';
import { getVerifiedActor } from '../src/auth/session.js';

describe('getVerifiedActor', () => {
  it('returns only the verified user id from a database session', async () => {
    const headers = new Headers({ cookie: 'better-auth.session_token=opaque' });
    const getSession = vi.fn().mockResolvedValue({
      user: { id: 'user-1', emailVerified: true },
      session: { id: 'session-1' },
    });
    const auth = { api: { getSession } } as never;

    await expect(getVerifiedActor(auth, headers)).resolves.toEqual({ userId: 'user-1' });
    expect(getSession).toHaveBeenCalledWith({ headers });
  });

  it('rejects missing and unverified sessions', async () => {
    const headers = new Headers();
    const unverified = {
      api: {
        getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', emailVerified: false } }),
      },
    } as never;
    const missing = { api: { getSession: vi.fn().mockResolvedValue(null) } } as never;

    await expect(getVerifiedActor(unverified, headers)).resolves.toBeNull();
    await expect(getVerifiedActor(missing, headers)).resolves.toBeNull();
  });
});
