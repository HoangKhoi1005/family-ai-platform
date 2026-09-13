import type { CreateEventInput, February29Policy } from '@family/contracts';
import {
  createVietnameseCalendarConverter,
  resolveLunarYearlyDates,
  type CalendarConverter,
  type GregorianDate,
} from '@family/domain';

export interface OccurrenceWindow {
  from: string;
  to: string;
}

export interface GeneratedOccurrence {
  localDate: string;
  startsAt: string | null;
  endsAt: string | null;
  calendarConversionVersion: string | null;
}

function formatDate(date: GregorianDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(
    date.day,
  ).padStart(2, '0')}`;
}

function parseDate(value: string): GregorianDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid occurrence window date: ${value}`);
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const parsed = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (
    parsed.getUTCFullYear() !== date.year ||
    parsed.getUTCMonth() + 1 !== date.month ||
    parsed.getUTCDate() !== date.day
  ) {
    throw new Error(`Invalid occurrence window date: ${value}`);
  }
  return date;
}

function validGregorianDate(year: number, month: number, day: number): GregorianDate | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function yearlyGregorianDate(
  year: number,
  month: number,
  day: number,
  feb29Policy: February29Policy | undefined,
): GregorianDate | null {
  const exact = validGregorianDate(year, month, day);
  if (exact) return exact;
  if (month !== 2 || day !== 29 || feb29Policy === undefined || feb29Policy === 'skip') return null;
  return feb29Policy === 'feb28' ? { year, month: 2, day: 28 } : { year, month: 3, day: 1 };
}

function withTiming(
  input: CreateEventInput,
  localDate: string,
): Omit<GeneratedOccurrence, 'localDate'> {
  if (input.all_day) return { startsAt: null, endsAt: null, calendarConversionVersion: null };
  const [year, month, day] = localDate.split('-').map(Number);
  const [hour, minute] = input.starts_local_time!.split(':').map(Number);
  // The pilot accepts only Asia/Ho_Chi_Minh, which is fixed at UTC+07 and has no DST.
  const starts = new Date(Date.UTC(year!, month! - 1, day!, hour! - 7, minute!));
  const ends =
    input.duration_minutes === undefined
      ? null
      : new Date(starts.getTime() + input.duration_minutes * 60_000).toISOString();
  return { startsAt: starts.toISOString(), endsAt: ends, calendarConversionVersion: null };
}

function inWindow(value: string, window: OccurrenceWindow): boolean {
  return value >= window.from && value <= window.to;
}

export function generateOccurrences(
  input: CreateEventInput,
  window: OccurrenceWindow,
  converter: CalendarConverter = createVietnameseCalendarConverter(),
): GeneratedOccurrence[] {
  const from = parseDate(window.from);
  const to = parseDate(window.to);
  if (window.from > window.to) throw new Error('Occurrence window must be ordered');

  const dates: GregorianDate[] = [];
  let conversionVersion: string | null = null;

  if (input.calendar_type === 'gregorian') {
    if (input.recurrence === 'none') {
      const date = validGregorianDate(
        input.date_parts.year!,
        input.date_parts.month,
        input.date_parts.day,
      );
      if (date) dates.push(date);
    } else {
      for (let year = from.year; year <= to.year; year += 1) {
        const date = yearlyGregorianDate(
          year,
          input.date_parts.month,
          input.date_parts.day,
          input.feb29_policy,
        );
        if (date) dates.push(date);
      }
    }
  } else {
    conversionVersion = converter.version;
    const firstLunarYear =
      input.recurrence === 'none'
        ? input.date_parts.year!
        : Math.max(converter.supportedYears.first, from.year - 1);
    const lastLunarYear =
      input.recurrence === 'none'
        ? input.date_parts.year!
        : Math.min(converter.supportedYears.last, to.year + 1);
    for (let year = firstLunarYear; year <= lastLunarYear; year += 1) {
      dates.push(
        ...resolveLunarYearlyDates(converter, {
          year,
          month: input.date_parts.month,
          day: input.date_parts.day,
          monthMode: input.lunar_policy.month_mode,
          missingDay: input.lunar_policy.missing_day,
        }),
      );
    }
  }

  const uniqueDates = [...new Set(dates.map(formatDate))].filter((date) => inWindow(date, window));
  return uniqueDates.sort().map((localDate) => {
    const timing = withTiming(input, localDate);
    return {
      localDate,
      startsAt: timing.startsAt,
      endsAt: timing.endsAt,
      calendarConversionVersion: conversionVersion,
    };
  });
}
