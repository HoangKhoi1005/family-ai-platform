import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CalendarUnavailableError,
  createVietnameseCalendarConverter,
  resolveLunarYearlyDates,
} from './calendar.js';

type ReferenceData = Readonly<{
  cases: ReadonlyArray<{
    source: string;
    solar: { year: number; month: number; day: number };
    lunar: { year: number; month: number; day: number; isLeapMonth: boolean };
  }>;
}>;

const reference = JSON.parse(
  readFileSync(new URL('../test-data/vietnamese-lunar-reference.json', import.meta.url), 'utf8'),
) as ReferenceData;

describe('Vietnamese lunar calendar adapter', () => {
  const converter = createVietnameseCalendarConverter();

  it('publishes the provider version and supported range', () => {
    expect(converter.version).toBe('@dqcai/vn-lunar@1.0.1');
    expect(converter.supportedYears).toEqual({ first: 1200, last: 2199 });
  });

  it.each(reference.cases)('matches the $source reference for $solar', ({ solar, lunar }) => {
    expect(converter.solarToLunar(solar)).toEqual(lunar);
    expect(converter.lunarToSolar(lunar)).toEqual(solar);
  });

  it('rejects dates outside the supported range', () => {
    expect(() => converter.solarToLunar({ year: 1199, month: 12, day: 31 })).toThrow(
      CalendarUnavailableError,
    );
    expect(() =>
      converter.lunarToSolar({ year: 2200, month: 1, day: 1, isLeapMonth: false }),
    ).toThrow(CalendarUnavailableError);
  });

  it('rejects invalid Gregorian and lunar inputs instead of normalizing them', () => {
    expect(() => converter.solarToLunar({ year: 2025, month: 2, day: 30 })).toThrow(
      CalendarUnavailableError,
    );
    expect(() =>
      converter.lunarToSolar({ year: 2025, month: 5, day: 1, isLeapMonth: true }),
    ).toThrow(CalendarUnavailableError);
  });
});

describe('lunar yearly occurrence policies', () => {
  const converter = createVietnameseCalendarConverter();

  it('resolves regular, leap-only and both month modes deterministically', () => {
    const base = { year: 2025, month: 6, day: 1, missingDay: 'skip' as const };

    expect(resolveLunarYearlyDates(converter, { ...base, monthMode: 'regular' })).toEqual([
      { year: 2025, month: 6, day: 25 },
    ]);
    expect(resolveLunarYearlyDates(converter, { ...base, monthMode: 'leap_only' })).toEqual([
      { year: 2025, month: 7, day: 25 },
    ]);
    expect(resolveLunarYearlyDates(converter, { ...base, monthMode: 'both' })).toEqual([
      { year: 2025, month: 6, day: 25 },
      { year: 2025, month: 7, day: 25 },
    ]);
  });

  it('uses or skips the last lunar day according to policy', () => {
    const base = { year: 2025, month: 6, day: 30, monthMode: 'leap_only' as const };

    expect(resolveLunarYearlyDates(converter, { ...base, missingDay: 'last_day' })).toEqual([
      { year: 2025, month: 8, day: 22 },
    ]);
    expect(resolveLunarYearlyDates(converter, { ...base, missingDay: 'skip' })).toEqual([]);
  });

  it('does not invent a leap-month occurrence in a year without that leap month', () => {
    expect(
      resolveLunarYearlyDates(converter, {
        year: 2026,
        month: 6,
        day: 1,
        monthMode: 'leap_only',
        missingDay: 'skip',
      }),
    ).toEqual([]);
  });

  it('propagates provider failures instead of silently skipping an occurrence', () => {
    const unavailableConverter = {
      ...converter,
      lunarToSolar() {
        throw new CalendarUnavailableError('Provider unavailable.', 'provider_failure');
      },
    };

    expect(() =>
      resolveLunarYearlyDates(unavailableConverter, {
        year: 2026,
        month: 6,
        day: 1,
        monthMode: 'regular',
        missingDay: 'skip',
      }),
    ).toThrow('Provider unavailable.');
  });
});
