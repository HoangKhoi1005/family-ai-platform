import { describe, expect, it } from 'vitest';
import { calendarGenerationWindow } from './calendar.js';

describe('calendarGenerationWindow', () => {
  it('clamps 18 calendar months to the last valid day instead of overflowing', () => {
    expect(calendarGenerationWindow('2026-08-31')).toEqual({
      from: '2026-08-01',
      to: '2028-02-29',
    });
    expect(calendarGenerationWindow('2026-03-31')).toEqual({
      from: '2026-03-01',
      to: '2027-09-30',
    });
  });
});
