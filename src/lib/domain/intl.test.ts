import { describe, expect, it } from 'vitest';
import { dateTimeFormat } from './intl';

describe('dateTimeFormat', () => {
  it('reuses one formatter for the same locale and options, so rendering a list does not build one per row', () => {
    const options = { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' } as const;
    expect(dateTimeFormat('en-GB', options)).toBe(dateTimeFormat('en-GB', { ...options }));
  });

  it('keeps formatters apart when the time zone differs', () => {
    const at = Date.UTC(2026, 10, 7, 12, 0);
    const clock = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
    expect(dateTimeFormat('en-GB', { ...clock, timeZone: 'UTC' }).format(at)).toBe('12:00');
    expect(dateTimeFormat('en-GB', { ...clock, timeZone: 'Asia/Tokyo' }).format(at)).toBe('21:00');
  });

  it('treats an option left out and an option set to undefined as the same formatter', () => {
    expect(dateTimeFormat('en-GB', { timeZone: undefined, day: 'numeric' })).toBe(
      dateTimeFormat('en-GB', { day: 'numeric' })
    );
  });
});
