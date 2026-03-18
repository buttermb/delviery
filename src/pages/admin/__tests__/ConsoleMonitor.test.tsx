/**
 * Tests for ConsoleMonitor component
 *
 * Verifies:
 * - Rendering and initial state
 * - Console interception (log, warn, error, info)
 * - Log filtering by type
 * - Search functionality with debounce
 * - Pause/resume log capture
 * - Export logs as JSON
 * - Clear logs
 * - Statistics display
 * - Millisecond formatting
 * - Message truncation for long messages
 * - Accessibility attributes
 * - Cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock useDebouncedValue to return value immediately in tests
vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: string) => ({
    debouncedValue: value,
    isPending: false,
    flush: vi.fn(),
    cancel: vi.fn(),
  }),
}));

// Polyfill for Radix UI in jsdom
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture || (() => { /* noop */ });
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture || (() => { /* noop */ });
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => { /* noop */ });
}

import { ConsoleMonitor } from '../ConsoleMonitor';

describe('ConsoleMonitor', () => {
  let savedLog: typeof console.log;
  let savedWarn: typeof console.warn;
  let savedError: typeof console.error;
  let savedInfo: typeof console.info;

  beforeEach(() => {
    // Save the real console methods before each test
    savedLog = console.log;
    savedWarn = console.warn;
    savedError = console.error;
    savedInfo = console.info;
  });

  afterEach(() => {
    cleanup();
    // Restore original console methods after cleanup (unmount restores them,
    // but in case cleanup didn't call unmount properly)
    console.log = savedLog;
    console.warn = savedWarn;
    console.error = savedError;
    console.info = savedInfo;
  });

  describe('Rendering', () => {
    it('renders the component with title and description', () => {
      render(<ConsoleMonitor />);

      expect(screen.getByText('Console Monitor')).toBeInTheDocument();
      expect(screen.getByText('Real-time console log tracking and filtering')).toBeInTheDocument();
    });

    it('renders search input with aria-label', () => {
      render(<ConsoleMonitor />);

      const searchInput = screen.getByLabelText('Search logs');
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search logs...');
    });

    it('renders filter select with aria-label', () => {
      render(<ConsoleMonitor />);

      expect(screen.getByLabelText('Filter by log type')).toBeInTheDocument();
    });

    it('renders action buttons with aria-labels', () => {
      render(<ConsoleMonitor />);

      expect(screen.getByLabelText('Pause log capture')).toBeInTheDocument();
      expect(screen.getByLabelText('Export logs as JSON')).toBeInTheDocument();
      expect(screen.getByLabelText('Clear all logs')).toBeInTheDocument();
    });

    it('shows empty state when no logs', () => {
      render(<ConsoleMonitor />);

      expect(screen.getByText('No Logs to Display')).toBeInTheDocument();
      expect(screen.getByText('Console logs will appear here in real-time.')).toBeInTheDocument();
    });

    it('displays initial statistics as zero', () => {
      render(<ConsoleMonitor />);

      expect(screen.getByText('Total: 0')).toBeInTheDocument();
      expect(screen.getByText('Errors: 0')).toBeInTheDocument();
      expect(screen.getByText('Warnings: 0')).toBeInTheDocument();
      expect(screen.getByText('Filtered: 0')).toBeInTheDocument();
    });

    it('renders statistics with proper aria attributes', () => {
      render(<ConsoleMonitor />);

      const statsContainer = screen.getByLabelText('Log statistics');
      expect(statsContainer).toHaveAttribute('role', 'status');
      expect(statsContainer).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Console Interception', () => {
    it('captures console.log messages', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('test log message');
      });

      expect(screen.getByText('test log message')).toBeInTheDocument();
      expect(screen.getByText('LOG')).toBeInTheDocument();
    });

    it('captures console.warn messages', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.warn('test warning');
      });

      expect(screen.getByText('test warning')).toBeInTheDocument();
      expect(screen.getByText('WARN')).toBeInTheDocument();
    });

    it('captures console.error messages', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.error('test error');
      });

      expect(screen.getByText('test error')).toBeInTheDocument();
      expect(screen.getByText('ERROR')).toBeInTheDocument();
    });

    it('captures console.info messages', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.info('test info');
      });

      expect(screen.getByText('test info')).toBeInTheDocument();
      expect(screen.getByText('INFO')).toBeInTheDocument();
    });

    it('serializes object arguments as JSON', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log({ key: 'value', nested: { a: 1 } });
      });

      expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
    });

    it('joins multiple arguments with spaces', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('hello', 'world', 123);
      });

      expect(screen.getByText('hello world 123')).toBeInTheDocument();
    });

    it('overrides console methods while mounted', () => {
      const origLog = console.log;
      render(<ConsoleMonitor />);

      expect(console.log).not.toBe(origLog);
    });

    it('updates statistics when logs are added', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('msg1');
        console.error('err1');
        console.warn('warn1');
        console.info('info1');
      });

      expect(screen.getByText('Total: 4')).toBeInTheDocument();
      expect(screen.getByText('Errors: 1')).toBeInTheDocument();
      expect(screen.getByText('Warnings: 1')).toBeInTheDocument();
      expect(screen.getByText('Filtered: 4')).toBeInTheDocument();
    });

    it('shows newest logs first', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('first');
        console.log('second');
        console.log('third');
      });

      const preElements = screen.getAllByText(/^(first|second|third)$/);
      expect(preElements[0]).toHaveTextContent('third');
      expect(preElements[2]).toHaveTextContent('first');
    });
  });

  describe('Filtering by Type', () => {
    it('filters logs by error type via select', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      act(() => {
        console.log('log message');
        console.error('error message');
        console.warn('warn message');
      });

      // Open select dropdown
      const trigger = screen.getByLabelText('Filter by log type');
      await user.click(trigger);

      // Select Error option
      const errorOption = await screen.findByRole('option', { name: 'Error' });
      await user.click(errorOption);

      expect(screen.getByText('error message')).toBeInTheDocument();
      expect(screen.queryByText('log message')).not.toBeInTheDocument();
      expect(screen.queryByText('warn message')).not.toBeInTheDocument();
    });

    it('shows all logs when "all" filter is active', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('log message');
        console.error('error message');
        console.info('info message');
      });

      expect(screen.getByText('log message')).toBeInTheDocument();
      expect(screen.getByText('error message')).toBeInTheDocument();
      expect(screen.getByText('info message')).toBeInTheDocument();
    });

    it('updates filtered count with active filter', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      act(() => {
        console.log('log1');
        console.log('log2');
        console.error('err1');
      });

      expect(screen.getByText('Total: 3')).toBeInTheDocument();
      expect(screen.getByText('Filtered: 3')).toBeInTheDocument();

      // Filter to errors only
      const trigger = screen.getByLabelText('Filter by log type');
      await user.click(trigger);
      const errorOption = await screen.findByRole('option', { name: 'Error' });
      await user.click(errorOption);

      expect(screen.getByText('Total: 3')).toBeInTheDocument();
      expect(screen.getByText('Filtered: 1')).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('filters logs by search text', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      act(() => {
        console.log('apple juice');
        console.log('orange soda');
        console.log('apple cider');
      });

      const searchInput = screen.getByLabelText('Search logs');
      await user.type(searchInput, 'apple');

      expect(screen.getByText('apple juice')).toBeInTheDocument();
      expect(screen.getByText('apple cider')).toBeInTheDocument();
      expect(screen.queryByText('orange soda')).not.toBeInTheDocument();
    });

    it('search is case-insensitive', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      act(() => {
        console.log('Hello World');
      });

      const searchInput = screen.getByLabelText('Search logs');
      await user.type(searchInput, 'hello');

      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('shows filter-specific empty state when search has no matches', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      act(() => {
        console.log('test message');
      });

      const searchInput = screen.getByLabelText('Search logs');
      await user.type(searchInput, 'zzz_no_match');

      expect(screen.getByText('No logs match your filters.')).toBeInTheDocument();
    });
  });

  describe('Pause/Resume', () => {
    it('pauses log capture when pause button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      await user.click(screen.getByLabelText('Pause log capture'));

      // Verify paused state in UI
      expect(screen.getByText('Paused')).toBeInTheDocument();
      expect(screen.getByLabelText('Resume log capture')).toBeInTheDocument();
      expect(screen.getByText('Resume')).toBeInTheDocument();

      // Logs should not be captured while paused
      act(() => {
        console.log('should not appear');
      });

      expect(screen.queryByText('should not appear')).not.toBeInTheDocument();
      expect(screen.getByText('Total: 0')).toBeInTheDocument();
    });

    it('resumes log capture when resume button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      // Pause then Resume
      await user.click(screen.getByLabelText('Pause log capture'));
      await user.click(screen.getByLabelText('Resume log capture'));

      // Verify resumed state
      expect(screen.queryByText('Paused')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Pause log capture')).toBeInTheDocument();

      // New logs should be captured
      act(() => {
        console.log('captured after resume');
      });

      expect(screen.getByText('captured after resume')).toBeInTheDocument();
    });
  });

  describe('Clear', () => {
    it('clears all logs when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConsoleMonitor />);

      act(() => {
        console.log('message 1');
        console.error('message 2');
      });

      expect(screen.getByText('Total: 2')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Clear all logs'));

      expect(screen.getByText('Total: 0')).toBeInTheDocument();
      expect(screen.getByText('No Logs to Display')).toBeInTheDocument();
    });
  });

  describe('Export', () => {
    it('creates a downloadable JSON file on export', async () => {
      const user = userEvent.setup();
      const mockCreateObjectURL = vi.fn(() => 'blob:test');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockClick = vi.fn();
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === 'a') {
          return { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;
        }
        return origCreateElement(tagName, options);
      });

      render(<ConsoleMonitor />);

      act(() => {
        console.log('export test');
      });

      await user.click(screen.getByLabelText('Export logs as JSON'));

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('logs error if export fails', async () => {
      const { logger: loggerMock } = await import('@/lib/logger');
      const user = userEvent.setup();

      const origCreateObjectURL = global.URL.createObjectURL;
      global.URL.createObjectURL = vi.fn(() => { throw new Error('blob error'); });

      render(<ConsoleMonitor />);

      await user.click(screen.getByLabelText('Export logs as JSON'));

      expect(loggerMock.error).toHaveBeenCalledWith('Failed to export console logs', expect.any(Error));

      global.URL.createObjectURL = origCreateObjectURL;
    });
  });

  describe('Message Formatting', () => {
    it('truncates messages longer than 5000 characters', () => {
      render(<ConsoleMonitor />);

      const longMessage = 'x'.repeat(6000);
      act(() => {
        console.log(longMessage);
      });

      const truncated = screen.getByText(/… \(truncated\)$/);
      expect(truncated).toBeInTheDocument();
    });

    it('does not truncate messages under the limit', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('short message');
      });

      expect(screen.getByText('short message')).toBeInTheDocument();
      expect(screen.queryByText(/truncated/)).not.toBeInTheDocument();
    });

    it('handles non-serializable objects gracefully', () => {
      render(<ConsoleMonitor />);

      const circular: Record<string, unknown> = {};
      circular.self = circular;

      act(() => {
        console.log(circular);
      });

      // Should fall back to String(arg) without crashing
      expect(screen.getByText('[object Object]')).toBeInTheDocument();
    });
  });

  describe('Timestamp Display', () => {
    it('includes seconds and padded milliseconds in the timestamp', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('timestamp test');
      });

      // Timestamp format from toLocaleTimeString includes seconds,
      // followed by .mmm (3-digit padded milliseconds)
      // The locale may include AM/PM, so we match loosely: digits:digits:digits followed by .digits
      const logContainer = screen.getByRole('log');
      expect(logContainer.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}.*\.\d{3}/);
    });
  });

  describe('Cleanup', () => {
    it('restores original console methods on unmount', () => {
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;
      const origInfo = console.info;

      const { unmount } = render(<ConsoleMonitor />);

      // Console methods should be overridden
      expect(console.log).not.toBe(origLog);

      unmount();

      // Console methods should be restored
      expect(console.log).toBe(origLog);
      expect(console.warn).toBe(origWarn);
      expect(console.error).toBe(origError);
      expect(console.info).toBe(origInfo);
    });
  });

  describe('Log Container', () => {
    it('renders log area with proper role and aria-label', () => {
      render(<ConsoleMonitor />);

      act(() => {
        console.log('role test');
      });

      const logContainer = screen.getByRole('log');
      expect(logContainer).toBeInTheDocument();
      expect(logContainer).toHaveAttribute('aria-label', 'Console output');
    });
  });
});
