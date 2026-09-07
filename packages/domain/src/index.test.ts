import { describe, expect, it } from 'vitest';
import { canReadContact, type Membership } from './index.js';
const membership: Membership = {
  userId: 'u1',
  familyId: 'fa',
  status: 'active',
  role: 'admin',
  memberId: 'm1',
};
const contact = { familyId: 'fa', memberId: 'm2', visibility: 'self' as const, value: 'SYNTHETIC' };
describe('contact authorization invariant', () => {
  it('does not grant admin access to another linked person’s private contact', () =>
    expect(canReadContact(membership, contact)).toBe(false));
  it('allows the linked owner', () =>
    expect(canReadContact({ ...membership, memberId: 'm2' }, contact)).toBe(true));
  it.each(['pending', 'revoked'] as const)('denies %s even for owner', (status) =>
    expect(canReadContact({ ...membership, status, memberId: 'm2' }, contact)).toBe(false),
  );
  it('denies another family and anonymous access', () => {
    expect(canReadContact({ ...membership, familyId: 'fb', memberId: 'm2' }, contact)).toBe(false);
    expect(canReadContact(null, contact)).toBe(false);
  });
  it('allows family-visible contacts for active members only', () =>
    expect(canReadContact(membership, { ...contact, visibility: 'family' })).toBe(true));
});
