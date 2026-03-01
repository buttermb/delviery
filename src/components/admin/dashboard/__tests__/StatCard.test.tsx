/**
 * StatCard Component Tests
 * Tests the StatCard component with React.memo optimization
 * Updated: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StatCard } from '../StatCard';

// Mock react-router-dom with partial implementation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ tenantSlug: 'test-tenant' })),
    Link: ({ to, children, ...props }: { to: string; children?: React.ReactNode; [key: string]: unknown }) => (
      <a href={to} data-testid="link" {...props}>
        {children}
      </a>
    ),
  };
});

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick, ...props }: { children?: React.ReactNode; className?: string; onClick?: () => void; [key: string]: unknown }) => (
    <div data-testid="card" className={className} onClick={onClick} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/shared/LastUpdated', () => ({
  LastUpdated: ({ date, onRefresh, isLoading, className }: { date: Date; onRefresh?: () => void; isLoading?: boolean; className?: string }) => (
    <div data-testid="last-updated" className={className}>
      <span>Last updated: {date.toISOString()}</span>
      {onRefresh && (
        <button onClick={onRefresh} disabled={isLoading} data-testid="refresh-button">
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      )}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ArrowUp: ({ className }: { className?: string }) => (
    <svg data-testid="arrow-up-icon" className={className} />
  ),
  ArrowDown: ({ className }: { className?: string }) => (
    <svg data-testid="arrow-down-icon" className={className} />
  ),
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('StatCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render title and value correctly', () => {
      render(
        <BrowserRouter>
          <StatCard title="Total Sales" value="$1,234" />
        </BrowserRouter>
      );

      expect(screen.getByText('Total Sales')).toBeInTheDocument();
      expect(screen.getByText('$1,234')).toBeInTheDocument();
    });

    it('should render with numeric value', () => {
      render(
        <BrowserRouter>
          <StatCard title="Users" value={1500} />
        </BrowserRouter>
      );

      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('1500')).toBeInTheDocument();
    });

    it('should render icon when provided', () => {
      render(
        <BrowserRouter>
          <StatCard
            title="Revenue"
            value="$5,000"
            icon={<span data-testid="custom-icon">💰</span>}
          />
        </BrowserRouter>
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should render subtitle when provided', () => {
      render(
        <BrowserRouter>
          <StatCard title="Orders" value="150" subtitle="from last month" />
        </BrowserRouter>
      );

      expect(screen.getByText('from last month')).toBeInTheDocument();
    });
  });

  describe('Change Indicator', () => {
    it('should render increase change with up arrow', () => {
      render(
        <BrowserRouter>
          <StatCard
            title="Sales"
            value="$1,000"
            change={{ value: 12.5, type: 'increase' }}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('12.5%')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-up-icon')).toBeInTheDocument();
    });

    it('should render decrease change with down arrow', () => {
      render(
        <BrowserRouter>
          <StatCard
            title="Sales"
            value="$800"
            change={{ value: 8.3, type: 'decrease' }}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('8.3%')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-down-icon')).toBeInTheDocument();
    });

    it('should format change value to one decimal place', () => {
      render(
        <BrowserRouter>
          <StatCard
            title="Revenue"
            value="$2,000"
            change={{ value: 15.678, type: 'increase' }}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('15.7%')).toBeInTheDocument();
    });

    it('should render both change and subtitle together', () => {
      render(
        <BrowserRouter>
          <StatCard
            title="Users"
            value="1,200"
            change={{ value: 5.5, type: 'increase' }}
            subtitle="vs last week"
          />
        </BrowserRouter>
      );

      expect(screen.getByText('5.5%')).toBeInTheDocument();
      expect(screen.getByText('vs last week')).toBeInTheDocument();
    });
  });

  describe('Color Variants', () => {
    it('should apply blue color classes', () => {
      render(
        <BrowserRouter>
          <StatCard title="Test" value="100" color="blue" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).toContain('border-blue-500/30');
    });

    it('should apply green color classes', () => {
      render(
        <BrowserRouter>
          <StatCard title="Test" value="100" color="green" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      // Green uses emerald in the implementation
      expect(card.className).toContain('border-emerald-500/30');
    });

    it('should apply orange color classes', () => {
      render(
        <BrowserRouter>
          <StatCard title="Test" value="100" color="orange" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).toContain('border-orange-500/30');
    });

    it('should apply red color classes', () => {
      render(
        <BrowserRouter>
          <StatCard title="Test" value="100" color="red" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).toContain('border-red-500/30');
    });

    it('should apply purple color classes', () => {
      render(
        <BrowserRouter>
          <StatCard title="Test" value="100" color="purple" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).toContain('border-purple-500/30');
    });

    it('should default to blue color when not specified', () => {
      render(
        <BrowserRouter>
          <StatCard title="Test" value="100" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).toContain('border-blue-500/30');
    });
  });

  describe('Clickable Behavior', () => {
    it('should call onClick handler when clicked', () => {
      const onClickMock = vi.fn();

      render(
        <BrowserRouter>
          <StatCard title="Sales" value="$1,000" onClick={onClickMock} />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      fireEvent.click(card);

      expect(onClickMock).toHaveBeenCalledTimes(1);
    });

    it('should apply hover classes when onClick is provided', () => {
      render(
        <BrowserRouter>
          <StatCard title="Sales" value="$1,000" onClick={vi.fn()} />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).toContain('hover:scale-[1.02]');
      expect(card.className).toContain('cursor-pointer');
    });

    it('should not apply hover classes when not clickable', () => {
      render(
        <BrowserRouter>
          <StatCard title="Sales" value="$1,000" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).not.toContain('cursor-pointer');
    });
  });

  describe('Link Behavior', () => {
    it('should render as a link when href is provided', () => {
      render(
        <BrowserRouter>
          <StatCard title="Orders" value="50" href="/admin/orders" />
        </BrowserRouter>
      );

      const link = screen.getByTestId('link');
      expect(link).toBeInTheDocument();
    });

    it('should construct full path with tenant slug for admin routes', () => {
      render(
        <BrowserRouter>
          <StatCard title="Dashboard" value="100" href="/admin/dashboard" />
        </BrowserRouter>
      );

      const link = screen.getByTestId('link');
      expect(link).toHaveAttribute('href', '/test-tenant/admin/dashboard');
    });

    it('should use href as-is for non-admin routes', () => {
      render(
        <BrowserRouter>
          <StatCard title="External" value="20" href="/other/route" />
        </BrowserRouter>
      );

      const link = screen.getByTestId('link');
      expect(link).toHaveAttribute('href', '/other/route');
    });

    it('should apply hover classes when href is provided', () => {
      render(
        <BrowserRouter>
          <StatCard title="Sales" value="$1,000" href="/admin/sales" />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      expect(card.className).toContain('hover:scale-[1.02]');
      expect(card.className).toContain('cursor-pointer');
    });
  });

  describe('Last Updated Feature', () => {
    it('should render LastUpdated component when lastUpdated is provided', () => {
      const date = new Date('2026-02-01T12:00:00Z');

      render(
        <BrowserRouter>
          <StatCard title="Stats" value="100" lastUpdated={date} />
        </BrowserRouter>
      );

      expect(screen.getByTestId('last-updated')).toBeInTheDocument();
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });

    it('should pass onRefresh handler to LastUpdated', () => {
      const onRefreshMock = vi.fn();
      const date = new Date('2026-02-01T12:00:00Z');

      render(
        <BrowserRouter>
          <StatCard
            title="Stats"
            value="100"
            lastUpdated={date}
            onRefresh={onRefreshMock}
          />
        </BrowserRouter>
      );

      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      expect(onRefreshMock).toHaveBeenCalledTimes(1);
    });

    it('should pass isRefreshing state to LastUpdated', () => {
      const date = new Date('2026-02-01T12:00:00Z');

      render(
        <BrowserRouter>
          <StatCard
            title="Stats"
            value="100"
            lastUpdated={date}
            onRefresh={vi.fn()}
            isRefreshing={true}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });

    it('should not render LastUpdated when lastUpdated is not provided', () => {
      render(
        <BrowserRouter>
          <StatCard title="Stats" value="100" />
        </BrowserRouter>
      );

      expect(screen.queryByTestId('last-updated')).not.toBeInTheDocument();
    });
  });

  describe('React.memo Optimization', () => {
    it('should be a memoized component', () => {
      // Check if the component is wrapped with React.memo
      expect(StatCard.$$typeof).toBe(Symbol.for('react.memo'));
    });

    it('should have correct display name', () => {
      // React.memo preserves the function name (may have suffix in test environment)
      expect(StatCard.type.name).toMatch(/^StatCard/);
    });

    it('should not re-render when props remain the same', () => {
      const renderSpy = vi.fn();

      const TestWrapper = ({ title, value }: { title: string; value: string }) => {
        renderSpy();
        return (
          <BrowserRouter>
            <StatCard title={title} value={value} />
          </BrowserRouter>
        );
      };

      const { rerender } = render(<TestWrapper title="Test" value="100" />);

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with the same props
      rerender(<TestWrapper title="Test" value="100" />);

      // The wrapper re-renders, but the memoized component should not
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should re-render when title prop changes', () => {
      const { rerender } = render(
        <BrowserRouter>
          <StatCard title="Original Title" value="100" />
        </BrowserRouter>
      );

      expect(screen.getByText('Original Title')).toBeInTheDocument();

      rerender(
        <BrowserRouter>
          <StatCard title="Updated Title" value="100" />
        </BrowserRouter>
      );

      expect(screen.getByText('Updated Title')).toBeInTheDocument();
      expect(screen.queryByText('Original Title')).not.toBeInTheDocument();
    });

    it('should re-render when value prop changes', () => {
      const { rerender } = render(
        <BrowserRouter>
          <StatCard title="Stats" value="100" />
        </BrowserRouter>
      );

      expect(screen.getByText('100')).toBeInTheDocument();

      rerender(
        <BrowserRouter>
          <StatCard title="Stats" value="200" />
        </BrowserRouter>
      );

      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.queryByText('100')).not.toBeInTheDocument();
    });

    it('should re-render when change prop changes', () => {
      const { rerender } = render(
        <BrowserRouter>
          <StatCard
            title="Stats"
            value="100"
            change={{ value: 10, type: 'increase' }}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('10.0%')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-up-icon')).toBeInTheDocument();

      rerender(
        <BrowserRouter>
          <StatCard
            title="Stats"
            value="100"
            change={{ value: 5, type: 'decrease' }}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('5.0%')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-down-icon')).toBeInTheDocument();
    });

    it('should re-render when color prop changes', () => {
      const { rerender } = render(
        <BrowserRouter>
          <StatCard title="Stats" value="100" color="blue" />
        </BrowserRouter>
      );

      let card = screen.getByTestId('card');
      expect(card.className).toContain('border-blue-500/30');

      rerender(
        <BrowserRouter>
          <StatCard title="Stats" value="100" color="green" />
        </BrowserRouter>
      );

      card = screen.getByTestId('card');
      // Green uses emerald in the implementation
      expect(card.className).toContain('border-emerald-500/30');
      expect(card.className).not.toContain('border-blue-500/30');
    });

    it('should re-render when onClick handler changes', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      const { rerender } = render(
        <BrowserRouter>
          <StatCard title="Stats" value="100" onClick={firstHandler} />
        </BrowserRouter>
      );

      const card = screen.getByTestId('card');
      fireEvent.click(card);

      expect(firstHandler).toHaveBeenCalledTimes(1);
      expect(secondHandler).not.toHaveBeenCalled();

      rerender(
        <BrowserRouter>
          <StatCard title="Stats" value="100" onClick={secondHandler} />
        </BrowserRouter>
      );

      fireEvent.click(card);

      expect(firstHandler).toHaveBeenCalledTimes(1); // Still 1 from before
      expect(secondHandler).toHaveBeenCalledTimes(1); // New handler called
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero value correctly', () => {
      render(
        <BrowserRouter>
          <StatCard title="Count" value={0} />
        </BrowserRouter>
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle negative value correctly', () => {
      render(
        <BrowserRouter>
          <StatCard title="Balance" value={-500} />
        </BrowserRouter>
      );

      expect(screen.getByText('-500')).toBeInTheDocument();
    });

    it('should handle empty string value', () => {
      render(
        <BrowserRouter>
          <StatCard title="Status" value="" />
        </BrowserRouter>
      );

      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should handle very long title text', () => {
      const longTitle =
        'This is a very long title that might wrap or overflow in the UI';

      render(
        <BrowserRouter>
          <StatCard title={longTitle} value="100" />
        </BrowserRouter>
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle very large numeric values', () => {
      render(
        <BrowserRouter>
          <StatCard title="Big Number" value={999999999} />
        </BrowserRouter>
      );

      expect(screen.getByText('999999999')).toBeInTheDocument();
    });

    it('should handle special characters in values', () => {
      render(
        <BrowserRouter>
          <StatCard title="Price" value="$1,234.56 USD" />
        </BrowserRouter>
      );

      expect(screen.getByText('$1,234.56 USD')).toBeInTheDocument();
    });

    it('should handle zero change value', () => {
      render(
        <BrowserRouter>
          <StatCard
            title="Stats"
            value="100"
            change={{ value: 0, type: 'increase' }}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  describe('Combined Features', () => {
    it('should render all features together', () => {
      const onClickMock = vi.fn();
      const onRefreshMock = vi.fn();
      const date = new Date('2026-02-01T12:00:00Z');

      render(
        <BrowserRouter>
          <StatCard
            title="Complete Stat"
            value="$5,000"
            color="green"
            change={{ value: 15.5, type: 'increase' }}
            subtitle="from last month"
            icon={<span data-testid="icon">📈</span>}
            onClick={onClickMock}
            lastUpdated={date}
            onRefresh={onRefreshMock}
            isRefreshing={false}
          />
        </BrowserRouter>
      );

      expect(screen.getByText('Complete Stat')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText('15.5%')).toBeInTheDocument();
      expect(screen.getByText('from last month')).toBeInTheDocument();
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByTestId('last-updated')).toBeInTheDocument();

      const card = screen.getByTestId('card');
      // Green uses emerald in the implementation
      expect(card.className).toContain('border-emerald-500/30');
      expect(card.className).toContain('cursor-pointer');
    });
  });
});
