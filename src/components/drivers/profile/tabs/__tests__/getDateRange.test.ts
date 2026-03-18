import { describe, it, expect, vi, afterEach } from 'vitest';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

// We test the same logic used in EarningsTab without importing private symbols.
// This validates the date-range and daily-label logic in isolation.

const RANGES = ['This Week', 'This Month', 'Last Month'] as const;
type Range = (typeof RANGES)[number];

function getDateRange(range: Range): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case 'This Week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'This Month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'Last Month': {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
  }
}

function getDayLabel(date: Date, range: Range): string {
  return range === 'This Week' ? format(date, 'EEE') : format(date, 'MMM d');
}

describe('getDateRange', () => {
  afterEach(() => vi.useRealTimers());

  it('This Week returns Mon–Sun boundaries', () => {
    vi.useFakeTimers();
    // Wednesday March 18 2026
    vi.setSystemTime(new Date(2026, 2, 18, 12, 0, 0));

    const { start, end } = getDateRange('This Week');

    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0);   // Sunday
    expect(start <= new Date()).toBe(true);
    expect(end >= new Date()).toBe(true);
  });

  it('This Month returns first and last day of current month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 18));

    const { start, end } = getDateRange('This Month');

    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(2); // March
    expect(end.getDate()).toBe(31);
    expect(end.getMonth()).toBe(2);
  });

  it('Last Month returns full previous month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 18));

    const { start, end } = getDateRange('Last Month');

    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(1); // February
    expect(end.getDate()).toBe(28);
    expect(end.getMonth()).toBe(1);
  });
});

describe('getDayLabel', () => {
  it('returns weekday abbreviation for This Week', () => {
    const wed = new Date(2026, 2, 18); // Wednesday
    expect(getDayLabel(wed, 'This Week')).toBe('Wed');
  });

  it('returns "MMM d" for This Month', () => {
    const date = new Date(2026, 2, 5);
    expect(getDayLabel(date, 'This Month')).toBe('Mar 5');
  });

  it('returns "MMM d" for Last Month', () => {
    const date = new Date(2026, 1, 14);
    expect(getDayLabel(date, 'Last Month')).toBe('Feb 14');
  });
});
