/**
 * TrialCountdown Tests
 *
 * Verifies:
 * - Renders correct time units (days, hours, minutes, seconds)
 * - Displays "Trial Time Remaining" label
 * - Returns null when trial has expired
 * - Handles future dates with proper unit breakdown
 * - Cleans up interval on unmount
 * - Clears interval when trial expires during countdown
 * - Does not start interval when trial is already expired
 * - Restarts interval when trialEndsAt prop changes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TrialCountdown } from '../TrialCountdown';

describe('TrialCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderCountdown = (trialEndsAt: string) => {
    return render(<TrialCountdown trialEndsAt={trialEndsAt} />);
  };

  const setNow = (date: Date) => {
    vi.setSystemTime(date);
  };

  describe('Time Unit Display', () => {
    it('should display all four time unit labels', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      renderCountdown('2026-03-25T12:30:45Z');

      expect(screen.getByText('Days')).toBeInTheDocument();
      expect(screen.getByText('Hours')).toBeInTheDocument();
      expect(screen.getByText('Minutes')).toBeInTheDocument();
      expect(screen.getByText('Seconds')).toBeInTheDocument();
    });

    it('should display "Trial Time Remaining" heading', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      renderCountdown('2026-03-25T12:30:45Z');

      expect(screen.getByText('Trial Time Remaining')).toBeInTheDocument();
    });

    it('should render correct days for a multi-day trial', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      // 5 days from now exactly
      renderCountdown('2026-03-26T00:00:00Z');

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render correct hours, minutes, seconds breakdown', () => {
      // Set now to a fixed time
      setNow(new Date('2026-03-21T00:00:00Z'));
      // 2 days, 3 hours, 15 minutes, 30 seconds from now
      renderCountdown('2026-03-23T03:15:30Z');

      expect(screen.getByText('2')).toBeInTheDocument(); // days
      expect(screen.getByText('3')).toBeInTheDocument(); // hours
      expect(screen.getByText('15')).toBeInTheDocument(); // minutes
      expect(screen.getByText('30')).toBeInTheDocument(); // seconds
    });

    it('should render zero for units that are zero', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      // Exactly 1 day from now (hours, minutes, seconds are 0)
      renderCountdown('2026-03-22T00:00:01Z');

      // days=1, hours=0, minutes=0, seconds=1
      const ones = screen.getAllByText('1');
      expect(ones).toHaveLength(2); // days and seconds both show 1
      // There should be two 0 values (hours and minutes)
      const zeros = screen.getAllByText('0');
      expect(zeros).toHaveLength(2);
    });

    it('should handle hours-only remaining time', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      // 6 hours from now
      renderCountdown('2026-03-21T06:00:00Z');

      // days=0, hours=6, minutes=0, seconds=0
      // Component returns null when all values are 0, but here hours=6
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('Hours')).toBeInTheDocument();
    });

    it('should handle minutes-only remaining time', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      // 45 minutes from now
      renderCountdown('2026-03-21T00:45:00Z');

      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('Minutes')).toBeInTheDocument();
    });

    it('should handle seconds-only remaining time', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      // 30 seconds from now
      renderCountdown('2026-03-21T00:00:30Z');

      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Seconds')).toBeInTheDocument();
    });
  });

  describe('Expired Trial', () => {
    it('should return null when trial has already expired', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      const { container } = renderCountdown('2026-03-20T00:00:00Z');

      expect(container.firstChild).toBeNull();
    });

    it('should return null when trial ends exactly now', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      const { container } = renderCountdown('2026-03-21T00:00:00Z');

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Countdown Timer', () => {
    it('should update countdown every second', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      renderCountdown('2026-03-21T00:00:05Z');

      // Initially 5 seconds
      expect(screen.getByText('5')).toBeInTheDocument();

      // Advance 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('4')).toBeInTheDocument();

      // Advance 1 more second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should transition from seconds to null when trial expires', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      const { container } = renderCountdown('2026-03-21T00:00:02Z');

      // Initially 2 seconds remaining
      expect(screen.getByText('2')).toBeInTheDocument();

      // Advance 2 seconds - trial expires
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(container.firstChild).toBeNull();
    });

    it('should clean up interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      setNow(new Date('2026-03-21T00:00:00Z'));
      const { unmount } = renderCountdown('2026-03-22T00:00:00Z');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should clear interval when trial expires during countdown', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      setNow(new Date('2026-03-21T00:00:00Z'));

      renderCountdown('2026-03-21T00:00:02Z');

      const callsBefore = clearIntervalSpy.mock.calls.length;

      // Advance past the trial end
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // clearInterval should have been called when diff <= 0
      expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(callsBefore);
      clearIntervalSpy.mockRestore();
    });

    it('should not start interval when trial is already expired', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      setNow(new Date('2026-03-21T00:00:00Z'));

      renderCountdown('2026-03-20T00:00:00Z');

      expect(setIntervalSpy).not.toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    });

    it('should restart interval when trialEndsAt prop changes', () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      setNow(new Date('2026-03-21T00:00:00Z'));

      const { rerender } = render(<TrialCountdown trialEndsAt="2026-03-22T00:00:00Z" />);

      const setIntervalCallsAfterMount = setIntervalSpy.mock.calls.length;

      rerender(<TrialCountdown trialEndsAt="2026-03-23T00:00:00Z" />);

      // Old interval should be cleared, new one started
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(setIntervalSpy.mock.calls.length).toBeGreaterThan(setIntervalCallsAfterMount);

      clearIntervalSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });

  describe('Large Time Values', () => {
    it('should handle 14-day trial correctly', () => {
      setNow(new Date('2026-03-21T00:00:00Z'));
      renderCountdown('2026-04-04T00:00:00Z');

      expect(screen.getByText('14')).toBeInTheDocument();
      expect(screen.getByText('Days')).toBeInTheDocument();
    });

    it('should handle 30-day trial correctly', () => {
      setNow(new Date('2026-03-01T00:00:00Z'));
      renderCountdown('2026-03-31T00:00:00Z');

      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Days')).toBeInTheDocument();
    });
  });
});
