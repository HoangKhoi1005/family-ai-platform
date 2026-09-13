import { describe, expect, it } from 'vitest';
import {
  calendarDraftPreview,
  calendarDraftToInput,
  createCalendarDraft,
  type CalendarDraft,
} from './calendar-form-model';

function draft(overrides: Partial<CalendarDraft> = {}): CalendarDraft {
  return {
    ...createCalendarDraft(new Date('2026-09-13T01:00:00.000Z')),
    title: 'Bữa cơm nhà',
    ...overrides,
  };
}

describe('calendar event editor model', () => {
  it('builds a minimal one-time Gregorian event without UI-only fields', () => {
    expect(
      calendarDraftToInput(
        draft({
          kind: 'gathering',
          date: { year: 2026, month: 10, day: 20 },
          location: 'Nhà bà Mai',
          reminderOffsets: ['seven_days', 'one_day'],
        }),
      ),
    ).toEqual({
      kind: 'gathering',
      title: 'Bữa cơm nhà',
      note: null,
      location: 'Nhà bà Mai',
      member_id: null,
      recurrence: 'none',
      timezone: 'Asia/Ho_Chi_Minh',
      date_parts: { year: 2026, month: 10, day: 20 },
      all_day: true,
      reminder_offsets: ['seven_days', 'one_day'],
      calendar_type: 'gregorian',
    });
  });

  it('previews the next yearly February 29 date using the chosen policy', () => {
    expect(
      calendarDraftPreview(
        draft({
          recurrence: 'yearly',
          date: { year: null, month: 2, day: 29 },
          feb29Policy: 'feb28',
        }),
        new Date('2027-03-01T01:00:00.000Z'),
      ),
    ).toEqual(['2028-02-29']);

    expect(
      calendarDraftPreview(
        draft({
          recurrence: 'yearly',
          date: { year: null, month: 2, day: 29 },
          feb29Policy: 'mar1',
        }),
        new Date('2026-03-02T01:00:00.000Z'),
      ),
    ).toEqual(['2027-03-01']);
  });

  it('previews verified regular and leap Vietnamese lunar dates', () => {
    expect(
      calendarDraftPreview(
        draft({
          calendarType: 'lunar_vietnamese',
          recurrence: 'yearly',
          date: { year: null, month: 6, day: 1 },
          lunarMonthMode: 'both',
          missingLunarDay: 'skip',
        }),
        new Date('2025-01-01T01:00:00.000Z'),
      ),
    ).toEqual(['2025-06-25', '2025-07-25']);
  });

  it('does not invent a leap-month preview when that lunar date does not exist', () => {
    expect(() =>
      calendarDraftPreview(
        draft({
          calendarType: 'lunar_vietnamese',
          recurrence: 'none',
          date: { year: 2026, month: 6, day: 1 },
          lunarMonthMode: 'leap_only',
          missingLunarDay: 'skip',
        }),
      ),
    ).toThrow('Không thể xác nhận ngày âm này');
  });

  it('rejects a lunar source year outside the verified converter range', () => {
    expect(() =>
      calendarDraftPreview(
        draft({
          calendarType: 'lunar_vietnamese',
          recurrence: 'yearly',
          date: { year: 2200, month: 8, day: 5 },
        }),
      ),
    ).toThrow('Năm nguồn phải từ 1200 đến 2199');
  });

  it('requires a related family member for birthdays', () => {
    expect(() => calendarDraftToInput(draft({ kind: 'birthday', memberId: '' }))).toThrow(
      'Chọn người có ngày sinh nhật',
    );
  });
});
