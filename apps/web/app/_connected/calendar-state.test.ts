import type { EventDetailResponse, EventOccurrenceDto } from '@family/contracts';
import { describe, expect, it } from 'vitest';
import {
  calendarTimelineRange,
  calendarTimelineReducer,
  createCalendarTimelineState,
} from './calendar-state';

const familyId = '10000000-0000-4000-8000-000000000001';

function occurrence(id: string, eventId: string, title: string, revision = 1): EventOccurrenceDto {
  return {
    id,
    event_id: eventId,
    event_revision: revision,
    local_date: '2026-09-20',
    starts_at: null,
    ends_at: null,
    calendar_conversion_version: null,
    status: 'active',
    my_rsvp: null,
    event: {
      id: eventId,
      kind: 'gathering',
      title,
      member_id: null,
      calendar_type: 'gregorian',
      all_day: true,
    },
  };
}

function readyState(occurrences: EventOccurrenceDto[]) {
  return {
    ...createCalendarTimelineState(),
    familyId,
    occurrences,
    phase: 'ready' as const,
    requestId: 1,
  };
}

describe('calendar timeline state', () => {
  it('uses the Vietnam calendar date and clamps the 18-month window', () => {
    expect(calendarTimelineRange(new Date('2026-08-31T08:00:00.000Z'))).toEqual({
      from: '2026-08-31',
      to: '2028-02-29',
    });
    expect(calendarTimelineRange(new Date('2026-12-31T18:00:00.000Z'))).toEqual({
      from: '2027-01-01',
      to: '2028-07-01',
    });
  });

  it('keeps the last good timeline when a refresh loses the network', () => {
    const ready = readyState([occurrence('occ-1', 'event-1', 'Giỗ bà')]);
    const loading = calendarTimelineReducer(ready, {
      type: 'load-started',
      familyId,
      requestId: 2,
    });
    const failed = calendarTimelineReducer(loading, {
      type: 'load-failed',
      familyId,
      requestId: 2,
      code: 'NETWORK_ERROR',
      accessRevoked: false,
    });

    expect(failed.phase).toBe('refresh-error');
    expect(failed.occurrences.map((item) => item.event.title)).toEqual(['Giỗ bà']);
  });

  it('removes every cached occurrence when family access is revoked', () => {
    const ready = readyState([occurrence('occ-1', 'event-1', 'Giỗ bà')]);
    const loading = calendarTimelineReducer(ready, {
      type: 'load-started',
      familyId,
      requestId: 2,
    });
    const revoked = calendarTimelineReducer(loading, {
      type: 'load-failed',
      familyId,
      requestId: 2,
      code: 'NOT_FOUND',
      accessRevoked: true,
    });

    expect(revoked).toEqual(createCalendarTimelineState());
  });

  it('ignores a response from an older timeline request', () => {
    const initial = createCalendarTimelineState();
    const first = calendarTimelineReducer(initial, {
      type: 'load-started',
      familyId,
      requestId: 1,
    });
    const second = calendarTimelineReducer(first, {
      type: 'load-started',
      familyId,
      requestId: 2,
    });
    const stale = calendarTimelineReducer(second, {
      type: 'load-succeeded',
      familyId,
      requestId: 1,
      generation: 0,
      occurrences: [occurrence('old', 'event-old', 'Ngày cũ')],
      nextCursor: null,
    });

    expect(stale).toBe(second);
    expect(stale.requestId).toBe(2);
    expect(stale.phase).toBe('loading');
  });

  it('keeps a successful event update when an earlier refresh finishes later', () => {
    const oldOccurrence = occurrence('old-occ', 'event-1', 'Bữa cơm cũ');
    const ready = readyState([oldOccurrence]);
    const refreshing = calendarTimelineReducer(ready, {
      type: 'load-started',
      familyId,
      requestId: 2,
    });
    const updatedOccurrence = occurrence('new-occ', 'event-1', 'Bữa cơm mới', 2);
    const detail = {
      event: { id: 'event-1', status: 'active' },
      occurrences: [updatedOccurrence],
    } as unknown as EventDetailResponse;
    const mutated = calendarTimelineReducer(refreshing, {
      type: 'event-succeeded',
      familyId,
      detail,
    });
    const stale = calendarTimelineReducer(mutated, {
      type: 'load-succeeded',
      familyId,
      requestId: 2,
      generation: refreshing.generation,
      occurrences: [oldOccurrence],
      nextCursor: null,
    });

    expect(stale.occurrences.map((item) => item.event.title)).toEqual(['Bữa cơm mới']);
    expect(stale.generation).toBe(1);
  });

  it('keeps an RSVP response when an earlier refresh finishes later', () => {
    const ready = readyState([occurrence('occ-1', 'event-1', 'Bữa cơm nhà')]);
    const refreshing = calendarTimelineReducer(ready, {
      type: 'load-started',
      familyId,
      requestId: 2,
    });
    const responded = calendarTimelineReducer(refreshing, {
      type: 'rsvp-succeeded',
      familyId,
      occurrenceId: 'occ-1',
      response: 'yes',
    });
    const stale = calendarTimelineReducer(responded, {
      type: 'load-succeeded',
      familyId,
      requestId: 2,
      generation: refreshing.generation,
      occurrences: [occurrence('occ-1', 'event-1', 'Bữa cơm nhà')],
      nextCursor: null,
    });

    expect(stale.occurrences[0]?.my_rsvp).toBe('yes');
  });
});
