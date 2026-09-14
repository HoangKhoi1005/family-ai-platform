import type { EventOccurrenceDto, MomentDto } from '@family/contracts';
import type { Member } from './types';

export interface ConnectedHomePerson {
  id: string;
  name: string;
  displayName: string;
}

export interface ConnectedHomeModel {
  viewerName: string;
  memberCount: number;
  people: ConnectedHomePerson[];
  nextOccurrence: EventOccurrenceDto | null;
  latestMoment: MomentDto | null;
  hasLinkedProfile: boolean;
}

export function buildConnectedHomeModel({
  viewerName,
  members,
  occurrences,
  moments,
  linkedMemberId,
}: {
  viewerName: string;
  members: Member[];
  occurrences: EventOccurrenceDto[];
  moments: MomentDto[];
  linkedMemberId: string | null;
}): ConnectedHomeModel {
  const nextOccurrence = [...occurrences]
    .filter((item) => item.status === 'active')
    .sort((left, right) => {
      const byDate = left.local_date.localeCompare(right.local_date);
      if (byDate !== 0) return byDate;
      const byStart = (left.starts_at ?? '').localeCompare(right.starts_at ?? '');
      return byStart === 0 ? left.id.localeCompare(right.id) : byStart;
    })[0];
  const latestMoment = [...moments].sort((left, right) => {
    const byDate = right.created_at.localeCompare(left.created_at);
    return byDate === 0 ? right.id.localeCompare(left.id) : byDate;
  })[0];

  return {
    viewerName,
    memberCount: members.length,
    people: members.slice(0, 5).map((item) => ({
      id: item.id,
      name: item.familiar_name ?? item.display_name,
      displayName: item.display_name,
    })),
    nextOccurrence: nextOccurrence ?? null,
    latestMoment: latestMoment ?? null,
    hasLinkedProfile: linkedMemberId !== null,
  };
}
