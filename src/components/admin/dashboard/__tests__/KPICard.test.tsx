/**
 * KPICard Component Tests
 * Tests:
 * - Basic card rendering
 * - Variant styles
 * - Trend indicators
 * - Skeleton loading state
 * Updated: 2026-02-01
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KPICard, KPICardSkeleton } from '../KPICard';
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";

describe('KPICard', () => {
  describe('Basic Rendering', () => {
    it('should render card with title and value', () => {
      render(
        <KPICard
          title="Test KPI"
          value={100}
          icon={<DollarSign data-testid="icon" />}
          description="Test description"
        />
      );

      expect(screen.getByText('Test KPI')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should render description when no trend is provided', () => {
      render(
        <KPICard
          title="Test KPI"
          value="$1,000"
          icon={<DollarSign />}
          description="Test description text"
        />
      );

      expect(screen.getByText('Test description text')).toBeInTheDocument();
    });

    it('should accept string or number values', () => {
      const { rerender } = render(
        <KPICard
          title="Test"
          value={42}
          icon={<DollarSign />}
          description="Description"
        />
      );

      expect(screen.getByText('42')).toBeInTheDocument();

      rerender(
        <KPICard
          title="Test"
          value="$42.00"
          icon={<DollarSign />}
          description="Description"
        />
      );

      expect(screen.getByText('$42.00')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should apply default variant styling', () => {
      const { container } = render(
        <KPICard
          title="Default"
          value={100}
          icon={<DollarSign />}
          description="Default variant"
          variant="default"
        />
      );

      const iconContainer = container.querySelector('.text-primary');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should apply success variant styling', () => {
      const { container } = render(
        <KPICard
          title="Success"
          value={100}
          icon={<DollarSign />}
          description="Success variant"
          variant="success"
        />
      );

      const iconContainer = container.querySelector('.text-green-600');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should apply warning variant styling', () => {
      const { container } = render(
        <KPICard
          title="Warning"
          value={100}
          icon={<DollarSign />}
          description="Warning variant"
          variant="warning"
        />
      );

      const iconContainer = container.querySelector('.text-orange-500');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should apply destructive variant styling', () => {
      const { container } = render(
        <KPICard
          title="Destructive"
          value={100}
          icon={<DollarSign />}
          description="Destructive variant"
          variant="destructive"
        />
      );

      const iconContainer = container.querySelector('.text-red-600');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Trend Indicators', () => {
    it('should display positive trend with up arrow', () => {
      const { container } = render(
        <KPICard
          title="Revenue"
          value={1000}
          icon={<DollarSign />}
          description="Test"
          trend={{ value: 15.5, label: 'vs last month' }}
        />
      );

      expect(screen.getByText(/\+15\.5%/)).toBeInTheDocument();
      expect(screen.getByText('vs last month')).toBeInTheDocument();

      // Check for green color on positive trend
      const trendElement = container.querySelector('.text-green-600');
      expect(trendElement).toBeInTheDocument();
    });

    it('should display negative trend with down arrow', () => {
      const { container } = render(
        <KPICard
          title="Revenue"
          value={1000}
          icon={<DollarSign />}
          description="Test"
          trend={{ value: -10.2, label: 'vs last month' }}
        />
      );

      expect(screen.getByText(/-10\.2%/)).toBeInTheDocument();
      expect(screen.getByText('vs last month')).toBeInTheDocument();

      // Check for red color on negative trend
      const trendElement = container.querySelector('.text-red-600');
      expect(trendElement).toBeInTheDocument();
    });

    it('should hide description when trend is provided', () => {
      render(
        <KPICard
          title="Revenue"
          value={1000}
          icon={<DollarSign />}
          description="This should not appear"
          trend={{ value: 15, label: 'vs last month' }}
        />
      );

      expect(screen.queryByText('This should not appear')).not.toBeInTheDocument();
      expect(screen.getByText('vs last month')).toBeInTheDocument();
    });

    it('should format trend value to one decimal place', () => {
      render(
        <KPICard
          title="Revenue"
          value={1000}
          icon={<DollarSign />}
          description="Test"
          trend={{ value: 15.556, label: 'vs last month' }}
        />
      );

      expect(screen.getByText(/\+15\.6%/)).toBeInTheDocument();
    });

    it('should handle zero trend value', () => {
      render(
        <KPICard
          title="Revenue"
          value={1000}
          icon={<DollarSign />}
          description="Test"
          trend={{ value: 0, label: 'vs last month' }}
        />
      );

      expect(screen.getByText(/\+0\.0%/)).toBeInTheDocument();
    });
  });

  describe('Hover Effect', () => {
    it('should have hover shadow transition class', () => {
      const { container } = render(
        <KPICard
          title="Test"
          value={100}
          icon={<DollarSign />}
          description="Test"
        />
      );

      const card = container.querySelector('.hover\\:shadow-md');
      expect(card).toBeInTheDocument();
    });
  });
});

describe('KPICardSkeleton', () => {
  it('should render skeleton placeholders', () => {
    const { container } = render(<KPICardSkeleton />);

    // Should have skeleton elements
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render within a Card component', () => {
    const { container } = render(<KPICardSkeleton />);

    // Should be wrapped in card structure
    expect(container.firstChild).toBeTruthy();
  });
});
