import type { OnboardingStateResponse } from '@family/contracts';

export interface Membership {
  id: string;
  status: 'active' | 'pending' | 'revoked';
  family_id?: string;
  name?: string;
  role?: 'admin' | 'member';
}
export interface Me {
  user: { id: string; name: string; email: string };
  memberships: Membership[];
}
export interface Contact {
  id?: string;
  kind: 'phone' | 'email' | 'facebook';
  value: string;
  visibility: 'self' | 'family';
}
export interface Member {
  id: string;
  display_name: string;
  familiar_name: string | null;
  hometown: string | null;
  biography?: string | null;
  version: number;
  contacts?: Contact[];
}
export type Onboarding = OnboardingStateResponse;
export interface Claim {
  id: string;
  version: number;
  member_version: number;
  member: Member;
  contacts: Contact[];
}
export interface AdminMembership {
  id: string;
  status: string;
  role: string;
  version: number;
  user: { name: string | null };
}
