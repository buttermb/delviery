/**
 * RouteErrorBoundary Component Tests
 * Tests error handling for route content
 * Updated: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RouteErrorBoundary } from '../RouteErrorBoundary';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/errorReporting', () => ({
  errorReporter: {
    report: vi.fn(),
  },
}));

vi.mock('@/utils/bugFinder', () => ({
  default: {
    reportRuntimeError: vi.fn(),
  },
}));

vi.mock('@/utils/serviceWorkerCache', () => ({
  clearAllCachesAndServiceWorkers: vi.fn().mockResolvedValue(undefined),
  reloadWithCacheBypass: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: { children?: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardFooter: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
}));

// Test components
const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
  throw new Error(message);
};

const WorkingComponent = () => <div data-testid="working-component">Working!</div>;

describe('RouteErrorBoundary', () => {
  // Suppress console errors during tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
    vi.clearAllMocks();
  });

  describe('Normal Rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <RouteErrorBoundary>
          <WorkingComponent />
        </RouteErrorBoundary>
      );

      expect(screen.getByTestId('working-component')).toBeInTheDocument();
      expect(screen.getByText('Working!')).toBeInTheDocument();
    });

    it('should not show error UI when children render successfully', () => {
      render(
        <RouteErrorBoundary>
          <WorkingComponent />
        </RouteErrorBoundary>
      );

      expect(screen.queryByText('Page Error')).not.toBeInTheDocument();
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should catch and display errors from children', () => {
      render(
        <RouteErrorBoundary>
          <ThrowError />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('should display error message', () => {
      render(
        <RouteErrorBoundary>
          <ThrowError message="Custom error message" />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
    });

    it('should show recovery options', () => {
      render(
        <RouteErrorBoundary>
          <ThrowError />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Go Back')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should log error with routePath when provided', async () => {
      const { logger } = await import('@/lib/logger');

      render(
        <RouteErrorBoundary routePath="/admin/test">
          <ThrowError message="Route error" />
        </RouteErrorBoundary>
      );

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Route Error Boundary caught an error',
          expect.any(Error),
          expect.objectContaining({
            component: 'RouteErrorBoundary',
            routePath: '/admin/test',
          })
        );
      });
    });
  });

  describe('Chunk Loading Errors', () => {
    it('should detect chunk loading errors', () => {
      render(
        <RouteErrorBoundary>
          <ThrowError message="Failed to fetch dynamically imported module" />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Module Loading Error Detected')).toBeInTheDocument();
      expect(screen.getByText('Clear Cache & Reload')).toBeInTheDocument();
    });

    it('should show clear cache button for chunk errors', () => {
      render(
        <RouteErrorBoundary>
          <ThrowError message="Loading chunk 123 failed" />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Clear Cache & Reload')).toBeInTheDocument();
    });

    it('should not show clear cache button for non-chunk errors', () => {
      render(
        <RouteErrorBoundary>
          <ThrowError message="Regular error" />
        </RouteErrorBoundary>
      );

      expect(screen.queryByText('Clear Cache & Reload')).not.toBeInTheDocument();
    });

    it('should call clearAllCachesAndServiceWorkers when clear cache is clicked', async () => {
      const { clearAllCachesAndServiceWorkers, reloadWithCacheBypass } = await import(
        '@/utils/serviceWorkerCache'
      );

      render(
        <RouteErrorBoundary>
          <ThrowError message="Failed to fetch dynamically imported module" />
        </RouteErrorBoundary>
      );

      const clearCacheButton = screen.getByText('Clear Cache & Reload');
      fireEvent.click(clearCacheButton);

      await waitFor(() => {
        expect(clearAllCachesAndServiceWorkers).toHaveBeenCalled();
        expect(reloadWithCacheBypass).toHaveBeenCalled();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should reset error state when Try Again is clicked', () => {
      // Use a state variable to control whether to throw
      let shouldThrow = true;
      const ConditionalError = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <WorkingComponent />;
      };

      render(
        <RouteErrorBoundary>
          <ConditionalError />
        </RouteErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText('Page Error')).toBeInTheDocument();

      // Click Try Again - this resets the error boundary
      const tryAgainButton = screen.getByText('Try Again');
      shouldThrow = false; // Now it won't throw
      fireEvent.click(tryAgainButton);

      // Working component should now be visible after reset
      waitFor(() => {
        expect(screen.queryByText('Page Error')).not.toBeInTheDocument();
      });
    });

    it('should navigate back when Go Back is clicked', () => {
      const backSpy = vi.spyOn(window.history, 'back');

      render(
        <RouteErrorBoundary>
          <ThrowError />
        </RouteErrorBoundary>
      );

      const goBackButton = screen.getByText('Go Back');
      fireEvent.click(goBackButton);

      expect(backSpy).toHaveBeenCalled();
      backSpy.mockRestore();
    });

    it('should navigate to dashboard when Dashboard is clicked', () => {
      // Store original location
      const originalLocation = window.location;

      // Mock window.location
      delete (window as unknown as { location?: Location }).location;
      window.location = { ...originalLocation, href: '' } as unknown as Location;

      render(
        <RouteErrorBoundary>
          <ThrowError />
        </RouteErrorBoundary>
      );

      const dashboardButton = screen.getByText('Dashboard');
      fireEvent.click(dashboardButton);

      expect(window.location.href).toBe('/');

      // Restore original location
      window.location = originalLocation;
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;

      render(
        <RouteErrorBoundary fallback={customFallback}>
          <ThrowError />
        </RouteErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
      expect(screen.queryByText('Page Error')).not.toBeInTheDocument();
    });
  });

  describe('Error Reporting', () => {
    it('should report error to errorReporter', async () => {
      const { errorReporter } = await import('@/utils/errorReporting');

      render(
        <RouteErrorBoundary routePath="/admin/test">
          <ThrowError message="Test error for reporting" />
        </RouteErrorBoundary>
      );

      await waitFor(() => {
        expect(errorReporter.report).toHaveBeenCalledWith(
          expect.any(Error),
          'RouteErrorBoundary',
          expect.objectContaining({
            routePath: '/admin/test',
          })
        );
      });
    });

    it('should report error to bugFinder', async () => {
      const bugFinder = (await import('@/utils/bugFinder')).default;

      render(
        <RouteErrorBoundary>
          <ThrowError />
        </RouteErrorBoundary>
      );

      await waitFor(() => {
        expect(bugFinder.reportRuntimeError).toHaveBeenCalledWith(
          expect.any(Error),
          'RouteErrorBoundary',
          expect.objectContaining({
            isChunkError: expect.any(Boolean),
            isWebSocketError: expect.any(Boolean),
          })
        );
      });
    });
  });

  describe('WebSocket Errors', () => {
    it('should detect WebSocket errors', async () => {
      const { logger } = await import('@/lib/logger');

      render(
        <RouteErrorBoundary>
          <ThrowError message="WebSocket connection failed" />
        </RouteErrorBoundary>
      );

      await waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          'WebSocket error detected. Manual recovery required.',
          expect.objectContaining({
            component: 'RouteErrorBoundary',
          })
        );
      });
    });

    it('should detect realtime connection errors', async () => {
      const { logger } = await import('@/lib/logger');

      render(
        <RouteErrorBoundary>
          <ThrowError message="realtime subscription error" />
        </RouteErrorBoundary>
      );

      await waitFor(() => {
        expect(logger.warn).toHaveBeenCalled();
      });
    });
  });

  describe('Development Mode', () => {
    it('should show stack trace in development mode', () => {
      // Note: import.meta.env.DEV is set in vitest config
      render(
        <RouteErrorBoundary>
          <ThrowError />
        </RouteErrorBoundary>
      );

      // Stack trace should be available in dev mode
      if (import.meta.env.DEV) {
        expect(screen.getByText('View stack trace')).toBeInTheDocument();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors with no message', () => {
      const ErrorWithNoMessage = () => {
        const error = new Error();
        (error as unknown as { message: undefined }).message = undefined;
        throw error;
      };

      render(
        <RouteErrorBoundary>
          <ErrorWithNoMessage />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Page Error')).toBeInTheDocument();
    });

    it('should handle multiple sequential errors', () => {
      // First error
      const { unmount } = render(
        <RouteErrorBoundary>
          <ThrowError message="First error" />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('First error')).toBeInTheDocument();

      // Unmount and create a new instance with a different error
      unmount();

      render(
        <RouteErrorBoundary>
          <ThrowError message="Second error" />
        </RouteErrorBoundary>
      );

      expect(screen.getByText('Second error')).toBeInTheDocument();
    });
  });
});
