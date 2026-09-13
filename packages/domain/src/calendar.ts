import { getLunarDate, getSolarDate } from '@dqcai/vn-lunar';

export type GregorianDate = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

export type VietnameseLunarDate = GregorianDate &
  Readonly<{
    isLeapMonth: boolean;
  }>;

export type CalendarConverter = Readonly<{
  version: string;
  supportedYears: Readonly<{ first: number; last: number }>;
  solarToLunar(date: GregorianDate): VietnameseLunarDate;
  lunarToSolar(date: VietnameseLunarDate): GregorianDate;
}>;

export class CalendarUnavailableError extends Error {
  readonly code = 'CALENDAR_UNAVAILABLE';
  readonly reason: CalendarUnavailableReason;

  constructor(message: string, reason: CalendarUnavailableReason, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CalendarUnavailableError';
    this.reason = reason;
  }
}

export type CalendarUnavailableReason = 'unsupported_year' | 'invalid_date' | 'provider_failure';

const SUPPORTED_YEARS = Object.freeze({ first: 1200, last: 2199 });
const CONVERTER_VERSION = '@dqcai/vn-lunar@1.0.1';

function isIntegerInRange(value: number, first: number, last: number): boolean {
  return Number.isInteger(value) && value >= first && value <= last;
}

function isValidGregorianDate(date: GregorianDate): boolean {
  if (
    !isIntegerInRange(date.year, SUPPORTED_YEARS.first, SUPPORTED_YEARS.last) ||
    !isIntegerInRange(date.month, 1, 12) ||
    !isIntegerInRange(date.day, 1, 31)
  ) {
    return false;
  }

  const value = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return (
    value.getUTCFullYear() === date.year &&
    value.getUTCMonth() + 1 === date.month &&
    value.getUTCDate() === date.day
  );
}

function assertSupportedYear(year: number): void {
  if (!isIntegerInRange(year, SUPPORTED_YEARS.first, SUPPORTED_YEARS.last)) {
    throw new CalendarUnavailableError(
      `Vietnamese lunar conversion supports years ${SUPPORTED_YEARS.first}-${SUPPORTED_YEARS.last}.`,
      'unsupported_year',
    );
  }
}

function assertLunarShape(date: VietnameseLunarDate): void {
  assertSupportedYear(date.year);
  if (
    !isIntegerInRange(date.month, 1, 12) ||
    !isIntegerInRange(date.day, 1, 30) ||
    typeof date.isLeapMonth !== 'boolean'
  ) {
    throw new CalendarUnavailableError('Invalid Vietnamese lunar date.', 'invalid_date');
  }
}

function sameGregorianDate(left: GregorianDate, right: GregorianDate): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

function sameLunarDate(left: VietnameseLunarDate, right: VietnameseLunarDate): boolean {
  return sameGregorianDate(left, right) && left.isLeapMonth === right.isLeapMonth;
}

export function createVietnameseCalendarConverter(): CalendarConverter {
  return {
    version: CONVERTER_VERSION,
    supportedYears: SUPPORTED_YEARS,
    solarToLunar(date) {
      assertSupportedYear(date.year);
      if (!isValidGregorianDate(date)) {
        throw new CalendarUnavailableError('Invalid Gregorian date.', 'invalid_date');
      }

      try {
        const result = getLunarDate(date.day, date.month, date.year);
        const lunar = {
          year: result.year,
          month: result.month,
          day: result.day,
          isLeapMonth: result.leap,
        };
        const reverse = getSolarDate(lunar.day, lunar.month, lunar.year, lunar.isLeapMonth);

        if (!sameGregorianDate(date, reverse)) {
          throw new CalendarUnavailableError(
            'Vietnamese lunar conversion failed verification.',
            'provider_failure',
          );
        }
        return lunar;
      } catch (error) {
        if (error instanceof CalendarUnavailableError) throw error;
        throw new CalendarUnavailableError(
          'Vietnamese lunar conversion is unavailable.',
          'provider_failure',
          { cause: error },
        );
      }
    },
    lunarToSolar(date) {
      assertLunarShape(date);

      try {
        const result = getSolarDate(date.day, date.month, date.year, date.isLeapMonth);
        const solar = { year: result.year, month: result.month, day: result.day };

        if (!isValidGregorianDate(solar)) {
          throw new CalendarUnavailableError(
            'Vietnamese lunar conversion returned an invalid date.',
            'provider_failure',
          );
        }

        const reverse = getLunarDate(solar.day, solar.month, solar.year);
        const verified = {
          year: reverse.year,
          month: reverse.month,
          day: reverse.day,
          isLeapMonth: reverse.leap,
        };
        if (!sameLunarDate(date, verified)) {
          throw new CalendarUnavailableError(
            'Vietnamese lunar date does not exist.',
            'invalid_date',
          );
        }
        return solar;
      } catch (error) {
        if (error instanceof CalendarUnavailableError) throw error;
        throw new CalendarUnavailableError(
          'Vietnamese lunar conversion is unavailable.',
          'provider_failure',
          { cause: error },
        );
      }
    },
  };
}

export type LunarMonthMode = 'regular' | 'leap_only' | 'both';
export type MissingLunarDayPolicy = 'last_day' | 'skip';

export type LunarYearlyDateRequest = Readonly<{
  year: number;
  month: number;
  day: number;
  monthMode: LunarMonthMode;
  missingDay: MissingLunarDayPolicy;
}>;

function resolveOneLunarDate(
  converter: CalendarConverter,
  request: LunarYearlyDateRequest,
  isLeapMonth: boolean,
): GregorianDate | null {
  const convert = (day: number) =>
    converter.lunarToSolar({
      year: request.year,
      month: request.month,
      day,
      isLeapMonth,
    });

  try {
    return convert(request.day);
  } catch (error) {
    if (!(error instanceof CalendarUnavailableError)) throw error;
    if (error.reason !== 'invalid_date') throw error;
    if (request.day === 30 && request.missingDay === 'last_day') {
      try {
        return convert(29);
      } catch (fallbackError) {
        if (!(fallbackError instanceof CalendarUnavailableError)) throw fallbackError;
        if (fallbackError.reason !== 'invalid_date') throw fallbackError;
      }
    }
    return null;
  }
}

export function resolveLunarYearlyDates(
  converter: CalendarConverter,
  request: LunarYearlyDateRequest,
): GregorianDate[] {
  assertSupportedYear(request.year);
  if (!isIntegerInRange(request.month, 1, 12) || !isIntegerInRange(request.day, 1, 30)) {
    throw new CalendarUnavailableError('Invalid Vietnamese lunar recurrence date.', 'invalid_date');
  }

  const leapModes =
    request.monthMode === 'both'
      ? [false, true]
      : request.monthMode === 'leap_only'
        ? [true]
        : [false];

  return leapModes
    .map((isLeapMonth) => resolveOneLunarDate(converter, request, isLeapMonth))
    .filter((date): date is GregorianDate => date !== null)
    .sort((left, right) =>
      `${left.year}-${String(left.month).padStart(2, '0')}-${String(left.day).padStart(2, '0')}`.localeCompare(
        `${right.year}-${String(right.month).padStart(2, '0')}-${String(right.day).padStart(2, '0')}`,
      ),
    );
}
