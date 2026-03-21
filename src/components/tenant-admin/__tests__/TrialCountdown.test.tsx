import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TrialCountdown } from "@/components/tenant-admin/TrialCountdown";

describe("TrialCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders countdown when trial is in the future", () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    render(<TrialCountdown trialEndsAt={futureDate} />);

    expect(screen.getByText("Trial Time Remaining")).toBeInTheDocument();
    expect(screen.getByText("Days")).toBeInTheDocument();
    expect(screen.getByText("Hours")).toBeInTheDocument();
    expect(screen.getByText("Minutes")).toBeInTheDocument();
    expect(screen.getByText("Seconds")).toBeInTheDocument();
  });

  it("renders null when trial has already expired", () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const { container } = render(<TrialCountdown trialEndsAt={pastDate} />);

    expect(container.innerHTML).toBe("");
  });

  it("updates countdown every second", () => {
    // Set trial to 10 seconds from now
    const futureDate = new Date(Date.now() + 10_000).toISOString();
    render(<TrialCountdown trialEndsAt={futureDate} />);

    // Initial render should show seconds
    const getSeconds = () => {
      const secondsLabel = screen.getByText("Seconds");
      return secondsLabel.previousElementSibling?.textContent;
    };

    const initialSeconds = getSeconds();

    // Advance by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const updatedSeconds = getSeconds();
    expect(Number(updatedSeconds)).toBeLessThan(Number(initialSeconds));
  });

  it("clears interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const futureDate = new Date(Date.now() + 60_000).toISOString();

    const { unmount } = render(<TrialCountdown trialEndsAt={futureDate} />);
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("clears interval when trial expires during countdown", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    // Set trial to expire in 2 seconds
    const futureDate = new Date(Date.now() + 2000).toISOString();

    render(<TrialCountdown trialEndsAt={futureDate} />);

    // Before expiry, clearInterval should not have been called
    // (beyond any initial setup)
    const callsBefore = clearIntervalSpy.mock.calls.length;

    // Advance past the trial end
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // clearInterval should have been called when diff <= 0
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    clearIntervalSpy.mockRestore();
  });

  it("does not start interval when trial is already expired", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const pastDate = new Date(Date.now() - 60_000).toISOString();

    render(<TrialCountdown trialEndsAt={pastDate} />);

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("displays correct time breakdown", () => {
    // 1 day, 2 hours, 30 minutes, 15 seconds from now
    const ms = (1 * 24 * 60 * 60 + 2 * 60 * 60 + 30 * 60 + 15) * 1000;
    const futureDate = new Date(Date.now() + ms).toISOString();

    render(<TrialCountdown trialEndsAt={futureDate} />);

    // Find the value elements (they are siblings before the label elements)
    const daysLabel = screen.getByText("Days");
    const hoursLabel = screen.getByText("Hours");
    const minutesLabel = screen.getByText("Minutes");
    const secondsLabel = screen.getByText("Seconds");

    expect(daysLabel.previousElementSibling?.textContent).toBe("1");
    expect(hoursLabel.previousElementSibling?.textContent).toBe("2");
    expect(minutesLabel.previousElementSibling?.textContent).toBe("30");
    expect(secondsLabel.previousElementSibling?.textContent).toBe("15");
  });

  it("restarts interval when trialEndsAt prop changes", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const date1 = new Date(Date.now() + 60_000).toISOString();
    const date2 = new Date(Date.now() + 120_000).toISOString();

    const { rerender } = render(<TrialCountdown trialEndsAt={date1} />);

    const setIntervalCallsAfterMount = setIntervalSpy.mock.calls.length;

    rerender(<TrialCountdown trialEndsAt={date2} />);

    // Old interval should be cleared, new one started
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(setIntervalSpy.mock.calls.length).toBeGreaterThan(setIntervalCallsAfterMount);

    clearIntervalSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });
});
