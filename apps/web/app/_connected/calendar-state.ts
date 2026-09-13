import type { EventDetailResponse, EventOccurrenceDto, EventRsvpResponse } from '@family/contracts';

export interface CalendarTimelineState {
  familyId: string | null;
  occurrences: EventOccurrenceDto[];
  nextCursor: string | null;
  phase: 'idle' | 'loading' | 'ready' | 'refresh-error';
  errorCode: string | null;
  requestId: number;
  generation: number;
}

export type CalendarTimelineAction =
  | { type: 'load-started'; familyId: string; requestId: number }
  | {
      type: 'load-succeeded';
      familyId: string;
      requestId: number;
      generation: number;
      occurrences: EventOccurrenceDto[];
      nextCursor: string | null;
    }
  | {
      type: 'load-failed';
      familyId: string;
      requestId: number;
      code: string;
      accessRevoked: boolean;
    }
  | { type: 'event-succeeded'; familyId: string; detail: EventDetailResponse }
  | {
      type: 'rsvp-succeeded';
      familyId: string;
      occurrenceId: string;
      response: EventRsvpResponse;
    }
  | { type: 'cleared' };

export function createCalendarTimelineState(): CalendarTimelineState {
  return {
    familyId: null,
    occurrences: [],
    nextCursor: null,
    phase: 'idle',
    errorCode: null,
    requestId: 0,
    generation: 0,
  };
}

export function calendarTimelineRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value('year');
  const month = value('month');
  const day = value('day');
  const targetMonthIndex = month - 1 + 18;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12) + 1;
  const targetDay = Math.min(day, new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate());
  const iso = (dateYear: number, dateMonth: number, dateDay: number) =>
    `${String(dateYear).padStart(4, '0')}-${String(dateMonth).padStart(2, '0')}-${String(dateDay).padStart(2, '0')}`;
  return {
    from: iso(year, month, day),
    to: iso(targetYear, targetMonth, targetDay),
  };
}

export function calendarTimelineReducer(
  state: CalendarTimelineState,
  action: CalendarTimelineAction,
): CalendarTimelineState {
  if (action.type === 'cleared') return createCalendarTimelineState();

  if (action.type === 'load-started') {
    if (action.familyId !== state.familyId) {
      return {
        ...createCalendarTimelineState(),
        familyId: action.familyId,
        phase: 'loading',
        requestId: action.requestId,
      };
    }
    if (action.requestId <= state.requestId) return state;
    return {
      ...state,
      phase: 'loading',
      errorCode: null,
      requestId: action.requestId,
    };
  }

  if (action.type === 'load-succeeded') {
    if (
      action.familyId !== state.familyId ||
      action.requestId !== state.requestId ||
      action.generation !== state.generation
    ) {
      return state;
    }
    return {
      ...state,
      occurrences: sortOccurrences(action.occurrences.filter((item) => item.status === 'active')),
      nextCursor: action.nextCursor,
      phase: 'ready',
      errorCode: null,
    };
  }

  if (action.type === 'load-failed') {
    if (action.familyId !== state.familyId || action.requestId !== state.requestId) return state;
    if (action.accessRevoked) return createCalendarTimelineState();
    return { ...state, phase: 'refresh-error', errorCode: action.code };
  }

  if (action.familyId !== state.familyId) return state;

  if (action.type === 'event-succeeded') {
    const otherEvents = state.occurrences.filter(
      (item) => item.event_id !== action.detail.event.id,
    );
    const currentOccurrences =
      action.detail.event.status === 'active'
        ? action.detail.occurrences.filter((item) => item.status === 'active')
        : [];
    return {
      ...state,
      occurrences: sortOccurrences([...otherEvents, ...currentOccurrences]),
      phase: 'ready',
      errorCode: null,
      generation: state.generation + 1,
    };
  }

  if (action.type === 'rsvp-succeeded') {
    return {
      ...state,
      occurrences: state.occurrences.map((item) =>
        item.id === action.occurrenceId ? { ...item, my_rsvp: action.response } : item,
      ),
      errorCode: null,
      generation: state.generation + 1,
    };
  }

  return state;
}

function sortOccurrences(items: EventOccurrenceDto[]) {
  return [...items].sort((left, right) => {
    const byDate = left.local_date.localeCompare(right.local_date);
    if (byDate !== 0) return byDate;
    const byStart = (left.starts_at ?? '').localeCompare(right.starts_at ?? '');
    return byStart === 0 ? left.id.localeCompare(right.id) : byStart;
  });
}
