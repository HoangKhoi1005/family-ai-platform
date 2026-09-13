import { describe, expect, it } from 'vitest';
import { createVietnameseCalendarConverter } from '@family/domain';
import type { CreateEventInput } from '@family/contracts';
import { generateOccurrences } from './calendar-occurrences.js';

const base: Omit<CreateEventInput, 'calendar_type' | 'date_parts'> = {
  kind: 'gathering',
  title: 'Ngày nhà mình',
  recurrence: 'yearly',
  timezone: 'Asia/Ho_Chi_Minh',
  all_day: true,
  reminder_offsets: ['one_day'],
};

describe('generateOccurrences', () => {
  it('generates yearly Gregorian dates inside the inclusive window', () => {
    const occurrences = generateOccurrences(
      {
        ...base,
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 9, day: 2 },
      },
      { from: '2025-09-03', to: '2027-09-02' },
    );

    expect(occurrences.map((item) => item.localDate)).toEqual(['2026-09-02', '2027-09-02']);
    expect(occurrences.every((item) => item.calendarConversionVersion === null)).toBe(true);
  });

  it('applies the explicit February 29 fallback policy', () => {
    const occurrences = generateOccurrences(
      {
        ...base,
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 2, day: 29 },
        feb29_policy: 'feb28',
      },
      { from: '2025-01-01', to: '2028-12-31' },
    );

    expect(occurrences.map((item) => item.localDate)).toEqual([
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('keeps regular and leap lunar occurrences as separate verified dates', () => {
    const converter = createVietnameseCalendarConverter();
    const occurrences = generateOccurrences(
      {
        ...base,
        calendar_type: 'lunar_vietnamese',
        date_parts: { year: null, month: 6, day: 1 },
        lunar_policy: { month_mode: 'both', missing_day: 'skip' },
      },
      { from: '2025-01-01', to: '2025-12-31' },
      converter,
    );

    expect(occurrences.map((item) => item.localDate)).toEqual(['2025-06-25', '2025-07-25']);
    expect(occurrences.every((item) => item.calendarConversionVersion === converter.version)).toBe(
      true,
    );
  });

  it('rejects a supplied lunar source year when its selected leap month does not exist', () => {
    expect(() =>
      generateOccurrences(
        {
          ...base,
          calendar_type: 'lunar_vietnamese',
          date_parts: { year: 2024, month: 6, day: 1 },
          lunar_policy: { month_mode: 'leap_only', missing_day: 'skip' },
        },
        { from: '2025-01-01', to: '2025-12-31' },
        createVietnameseCalendarConverter(),
      ),
    ).toThrow(/source year/i);
  });

  it('converts a local timed event to UTC and applies duration', () => {
    const occurrences = generateOccurrences(
      {
        ...base,
        calendar_type: 'gregorian',
        date_parts: { year: null, month: 9, day: 13 },
        all_day: false,
        starts_local_time: '19:30',
        duration_minutes: 90,
      },
      { from: '2026-09-13', to: '2026-09-13' },
    );

    expect(occurrences).toEqual([
      {
        localDate: '2026-09-13',
        startsAt: '2026-09-13T12:30:00.000Z',
        endsAt: '2026-09-13T14:00:00.000Z',
        calendarConversionVersion: null,
      },
    ]);
  });
});
