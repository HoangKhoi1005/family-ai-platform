import type {
  CreateEventInput,
  EventCalendarType,
  EventDto,
  EventKind,
  EventRecurrence,
  EventReminderOffset,
  February29Policy,
  LunarMonthMode,
  MissingLunarDayPolicy,
} from '@family/contracts';
import {
  CalendarUnavailableError,
  createVietnameseCalendarConverter,
  resolveLunarYearlyDates,
} from '@family/domain';

export interface CalendarDraft {
  kind: EventKind;
  title: string;
  memberId: string;
  calendarType: EventCalendarType;
  recurrence: EventRecurrence;
  date: { year: number | null; month: number; day: number };
  lunarMonthMode: LunarMonthMode;
  missingLunarDay: MissingLunarDayPolicy;
  feb29Policy: February29Policy;
  allDay: boolean;
  startsLocalTime: string;
  durationMinutes: number;
  location: string;
  note: string;
  reminderOffsets: EventReminderOffset[];
}

const converter = createVietnameseCalendarConverter();

export function createCalendarDraft(now = new Date()): CalendarDraft {
  const today = vietnamDateParts(now);
  return {
    kind: 'gathering',
    title: '',
    memberId: '',
    calendarType: 'gregorian',
    recurrence: 'none',
    date: today,
    lunarMonthMode: 'regular',
    missingLunarDay: 'last_day',
    feb29Policy: 'feb28',
    allDay: true,
    startsLocalTime: '18:00',
    durationMinutes: 120,
    location: '',
    note: '',
    reminderOffsets: ['seven_days', 'one_day'],
  };
}

export function calendarDraftFromEvent(event: EventDto): CalendarDraft {
  return {
    kind: event.kind,
    title: event.title,
    memberId: event.member_id ?? '',
    calendarType: event.calendar_type,
    recurrence: event.recurrence,
    date: event.date_parts,
    lunarMonthMode:
      event.calendar_type === 'lunar_vietnamese' ? event.lunar_policy.month_mode : 'regular',
    missingLunarDay:
      event.calendar_type === 'lunar_vietnamese' ? event.lunar_policy.missing_day : 'last_day',
    feb29Policy: event.calendar_type === 'gregorian' ? (event.feb29_policy ?? 'feb28') : 'feb28',
    allDay: event.all_day,
    startsLocalTime: event.starts_local_time ?? '18:00',
    durationMinutes: event.duration_minutes ?? 120,
    location: event.location ?? '',
    note: event.note ?? '',
    reminderOffsets: [...event.reminder_offsets],
  };
}

export function calendarDraftToInput(draft: CalendarDraft): CreateEventInput {
  const title = draft.title.trim();
  if (!title) throw new Error('Ghi tên ngày quan trọng');
  if (draft.kind === 'birthday' && !draft.memberId) {
    throw new Error('Chọn người có ngày sinh nhật');
  }
  validateDateParts(draft);

  const common = {
    kind: draft.kind,
    title,
    note: textOrNull(draft.note),
    location: textOrNull(draft.location),
    member_id: draft.memberId || null,
    recurrence: draft.recurrence,
    timezone: 'Asia/Ho_Chi_Minh' as const,
    date_parts: draft.date,
    all_day: draft.allDay,
    ...(draft.allDay
      ? {}
      : {
          starts_local_time: draft.startsLocalTime,
          duration_minutes: draft.durationMinutes,
        }),
    reminder_offsets: draft.reminderOffsets,
  };

  if (draft.calendarType === 'lunar_vietnamese') {
    return {
      ...common,
      calendar_type: 'lunar_vietnamese',
      lunar_policy: {
        month_mode: draft.lunarMonthMode,
        missing_day: draft.missingLunarDay,
      },
    };
  }

  return {
    ...common,
    calendar_type: 'gregorian',
    ...(draft.recurrence === 'yearly' && draft.date.month === 2 && draft.date.day === 29
      ? { feb29_policy: draft.feb29Policy }
      : {}),
  };
}

export function calendarDraftPreview(draft: CalendarDraft, now = new Date()): string[] {
  calendarDraftToInput(draft);
  const today = isoDate(vietnamDateParts(now));
  if (draft.calendarType === 'gregorian') return previewGregorian(draft, today);

  try {
    if (draft.recurrence === 'none') {
      if (draft.date.year === null || draft.lunarMonthMode === 'both') {
        throw new CalendarUnavailableError('Invalid one-time lunar date.', 'invalid_date');
      }
      const result = converter.lunarToSolar({
        year: draft.date.year,
        month: draft.date.month,
        day: draft.date.day,
        isLeapMonth: draft.lunarMonthMode === 'leap_only',
      });
      return [isoDate(result)];
    }

    const currentYear = vietnamDateParts(now).year;
    for (let year = currentYear; year <= currentYear + 4; year++) {
      const results = resolveLunarYearlyDates(converter, {
        year,
        month: draft.date.month,
        day: draft.date.day,
        monthMode: draft.lunarMonthMode,
        missingDay: draft.missingLunarDay,
      })
        .map(isoDate)
        .filter((date) => date >= today);
      if (results.length > 0) return results;
    }
  } catch (error) {
    if (!(error instanceof CalendarUnavailableError)) throw error;
  }
  throw new Error('Không thể xác nhận ngày âm này');
}

function previewGregorian(draft: CalendarDraft, today: string): string[] {
  if (draft.recurrence === 'none') return [isoDate(requiredGregorianDate(draft.date))];
  const currentYear = Number(today.slice(0, 4));
  for (let year = currentYear; year <= currentYear + 8; year++) {
    let month = draft.date.month;
    let day = draft.date.day;
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      if (draft.feb29Policy === 'skip') continue;
      if (draft.feb29Policy === 'mar1') {
        month = 3;
        day = 1;
      } else {
        day = 28;
      }
    }
    const date = isoDate({ year, month, day });
    if (date >= today) return [date];
  }
  throw new Error('Không tìm thấy lần diễn ra kế tiếp');
}

function validateDateParts(draft: CalendarDraft) {
  if (draft.recurrence === 'none' && draft.date.year === null) {
    throw new Error('Chọn năm cho ngày diễn ra một lần');
  }
  if (
    draft.calendarType === 'lunar_vietnamese' &&
    draft.date.year !== null &&
    (!Number.isInteger(draft.date.year) || draft.date.year < 1200 || draft.date.year > 2199)
  ) {
    throw new Error('Năm nguồn phải từ 1200 đến 2199');
  }
  if (draft.calendarType === 'gregorian') requiredGregorianDate(draft.date);
  else if (
    !Number.isInteger(draft.date.month) ||
    draft.date.month < 1 ||
    draft.date.month > 12 ||
    !Number.isInteger(draft.date.day) ||
    draft.date.day < 1 ||
    draft.date.day > 30
  ) {
    throw new Error('Ngày âm chưa hợp lệ');
  }
  if (!draft.allDay && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.startsLocalTime)) {
    throw new Error('Giờ bắt đầu chưa hợp lệ');
  }
}

function requiredGregorianDate(date: CalendarDraft['date']) {
  if (date.year === null) {
    return { year: 2000, month: date.month, day: date.day };
  }
  const parsed = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (
    parsed.getUTCFullYear() !== date.year ||
    parsed.getUTCMonth() + 1 !== date.month ||
    parsed.getUTCDate() !== date.day
  ) {
    throw new Error('Ngày dương chưa hợp lệ');
  }
  return { year: date.year, month: date.month, day: date.day };
}

function vietnamDateParts(now: Date) {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(values.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

function isoDate(date: { year: number; month: number; day: number }) {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function textOrNull(value: string) {
  return value.trim() || null;
}

function isLeapYear(year: number) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}
