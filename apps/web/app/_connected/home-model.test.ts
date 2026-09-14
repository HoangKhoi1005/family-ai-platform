import type { EventOccurrenceDto, MomentDto } from '@family/contracts';
import { describe, expect, it } from 'vitest';
import type { Member } from './types';
import { buildConnectedHomeModel } from './home-model';

const member = (id: string, displayName: string, familiarName: string | null = null): Member => ({
  id,
  display_name: displayName,
  familiar_name: familiarName,
  hometown: null,
  version: 1,
});

const occurrence = (
  id: string,
  localDate: string,
  startsAt: string | null,
  title: string,
): EventOccurrenceDto => ({
  id,
  event_id: `event-${id}`,
  event_revision: 1,
  local_date: localDate,
  starts_at: startsAt,
  ends_at: null,
  calendar_conversion_version: null,
  status: 'active',
  my_rsvp: null,
  event: {
    id: `event-${id}`,
    kind: 'gathering',
    title,
    member_id: null,
    calendar_type: 'gregorian',
    all_day: startsAt === null,
  },
});

describe('connected home model', () => {
  it('keeps an empty house honest and does not invent people or an event', () => {
    expect(
      buildConnectedHomeModel({
        viewerName: 'Gia Bảo',
        members: [],
        occurrences: [],
        moments: [],
        linkedMemberId: null,
      }),
    ).toEqual({
      viewerName: 'Gia Bảo',
      memberCount: 0,
      people: [],
      nextOccurrence: null,
      latestMoment: null,
      hasLinkedProfile: false,
    });
  });

  it('uses familiar names, limits the people row and preserves directory order', () => {
    const members = [
      member('1', 'Nguyễn Thị Minh Anh', 'Minh Anh'),
      member('2', 'Trần Hoàng Khôi'),
      member('3', 'Nguyễn Văn Một'),
      member('4', 'Nguyễn Văn Hai'),
      member('5', 'Nguyễn Văn Ba'),
      member('6', 'Nguyễn Văn Bốn'),
    ];

    expect(
      buildConnectedHomeModel({
        viewerName: 'Gia Bảo',
        members,
        occurrences: [],
        moments: [],
        linkedMemberId: '2',
      }),
    ).toMatchObject({
      memberCount: 6,
      hasLinkedProfile: true,
      people: [
        { id: '1', name: 'Minh Anh', displayName: 'Nguyễn Thị Minh Anh' },
        { id: '2', name: 'Trần Hoàng Khôi', displayName: 'Trần Hoàng Khôi' },
        { id: '3', name: 'Nguyễn Văn Một', displayName: 'Nguyễn Văn Một' },
        { id: '4', name: 'Nguyễn Văn Hai', displayName: 'Nguyễn Văn Hai' },
        { id: '5', name: 'Nguyễn Văn Ba', displayName: 'Nguyễn Văn Ba' },
      ],
    });
  });

  it('chooses the nearest active occurrence independently of API order', () => {
    const near = occurrence('near', '2026-09-16', null, 'Cơm nhà cuối tuần');
    const sameDayLater = occurrence(
      'later',
      '2026-09-16',
      '2026-09-16T12:00:00.000Z',
      'Gọi điện cho bà',
    );
    const far = occurrence('far', '2026-10-20', null, 'Họp mặt gia đình');

    expect(
      buildConnectedHomeModel({
        viewerName: 'Gia Bảo',
        members: [],
        occurrences: [far, sameDayLater, near],
        moments: [],
        linkedMemberId: null,
      }).nextOccurrence,
    ).toBe(near);
  });

  it('chooses the latest real Moment independently of response order', () => {
    const older = { id: 'older', created_at: '2026-09-13T08:00:00.000Z' } as MomentDto;
    const latest = { id: 'latest', created_at: '2026-09-14T08:00:00.000Z' } as MomentDto;

    expect(
      buildConnectedHomeModel({
        viewerName: 'Gia Bảo',
        members: [],
        occurrences: [],
        moments: [older, latest],
        linkedMemberId: null,
      }).latestMoment,
    ).toBe(latest);
  });
});
