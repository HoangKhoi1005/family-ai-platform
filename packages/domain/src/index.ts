export type Membership = Readonly<{
  userId: string;
  familyId: string;
  status: 'pending' | 'active' | 'revoked';
  role: 'admin' | 'member';
  memberId: string | null;
}>;
export type Contact = Readonly<{
  familyId: string;
  memberId: string;
  visibility: 'family' | 'self';
  value: string;
}>;

// Policy primitive only: the server must resolve membership from verified identity.
export function canReadContact(membership: Membership | null, contact: Contact): boolean {
  if (!membership || membership.status !== 'active' || membership.familyId !== contact.familyId)
    return false;
  return contact.visibility === 'family' || membership.memberId === contact.memberId;
}
