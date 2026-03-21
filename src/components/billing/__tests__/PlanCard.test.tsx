import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCard, PlanCardSkeleton } from '../PlanCard';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...rest }: Record<string, unknown>) => (
      <div className={className as string} data-testid="motion-div">{children as React.ReactNode}</div>
    ),
    li: ({ children, className, ...rest }: Record<string, unknown>) => (
      <li className={className as string}>{children as React.ReactNode}</li>
    ),
  },
}));

const basePlan = {
  name: 'starter',
  display_name: 'Starter',
  description: 'For small businesses',
  price_monthly: 79,
  price_yearly: 790,
  features: ['Feature A', 'Feature B'],
  limits: { products: 100, staff: 3 },
};

describe('PlanCard', () => {
  describe('Basic Rendering', () => {
    it('should render plan name and description', () => {
      render(<PlanCard plan={basePlan} />);

      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('For small businesses')).toBeInTheDocument();
    });

    it('should render monthly price by default', () => {
      render(<PlanCard plan={basePlan} />);

      expect(screen.getByText('/month')).toBeInTheDocument();
    });

    it('should render features', () => {
      render(<PlanCard plan={basePlan} />);

      expect(screen.getByText('Feature A')).toBeInTheDocument();
      expect(screen.getByText('Feature B')).toBeInTheDocument();
    });

    it('should render limits', () => {
      render(<PlanCard plan={basePlan} />);

      expect(screen.getByText('products:')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('staff:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render unlimited for -1 limit values', () => {
      const plan = { ...basePlan, limits: { products: -1 } };
      render(<PlanCard plan={plan} />);

      expect(screen.getByText('Unlimited')).toBeInTheDocument();
    });
  });

  describe('Current Plan Badge', () => {
    it('should show Current Plan badge when plan matches current', () => {
      render(<PlanCard plan={basePlan} currentPlan="starter" />);

      const currentPlanElements = screen.getAllByText('Current Plan');
      // Badge + button text both show "Current Plan"
      expect(currentPlanElements.length).toBe(2);
    });

    it('should not show Current Plan badge when plan does not match', () => {
      render(<PlanCard plan={basePlan} currentPlan="professional" />);

      const buttons = screen.getAllByText('Select Plan');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should disable button when plan is current', () => {
      render(<PlanCard plan={basePlan} currentPlan="starter" />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Loading State - Spinner', () => {
    it('should show spinner when isLoading is true', () => {
      const { container } = render(<PlanCard plan={basePlan} isLoading />);

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should disable button when isLoading is true', () => {
      render(<PlanCard plan={basePlan} isLoading />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should not show Select Plan text when loading', () => {
      render(<PlanCard plan={basePlan} isLoading />);

      expect(screen.queryByText('Select Plan')).not.toBeInTheDocument();
    });

    it('should show Select Plan text when not loading', () => {
      render(<PlanCard plan={basePlan} isLoading={false} />);

      expect(screen.getByText('Select Plan')).toBeInTheDocument();
    });

    it('should not call onSelect when loading and button clicked', () => {
      const onSelect = vi.fn();
      render(<PlanCard plan={basePlan} isLoading onSelect={onSelect} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Select Action', () => {
    it('should call onSelect with plan name when button clicked', () => {
      const onSelect = vi.fn();
      render(<PlanCard plan={basePlan} onSelect={onSelect} />);

      const button = screen.getByRole('button', { name: 'Select Plan' });
      fireEvent.click(button);

      expect(onSelect).toHaveBeenCalledWith('starter');
    });

    it('should not call onSelect when current plan', () => {
      const onSelect = vi.fn();
      render(<PlanCard plan={basePlan} currentPlan="starter" onSelect={onSelect} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Yearly Pricing', () => {
    it('should show yearly price when showYearly is true', () => {
      render(<PlanCard plan={basePlan} showYearly />);

      expect(screen.getByText('/year')).toBeInTheDocument();
    });

    it('should show monthly equivalent when yearly billing', () => {
      render(<PlanCard plan={basePlan} showYearly />);

      expect(screen.getByText(/billed annually/)).toBeInTheDocument();
    });
  });
});

describe('PlanCardSkeleton', () => {
  it('should render skeleton placeholders', () => {
    render(<PlanCardSkeleton />);

    const skeleton = screen.getByTestId('plan-card-skeleton');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render skeleton elements with loading role', () => {
    const { container } = render(<PlanCardSkeleton />);

    const loadingElements = container.querySelectorAll('[role="status"]');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should render 4 feature skeleton lines', () => {
    const { container } = render(<PlanCardSkeleton />);

    const listItems = container.querySelectorAll('li');
    expect(listItems).toHaveLength(4);
  });

  it('should render a button-sized skeleton at the bottom', () => {
    const { container } = render(<PlanCardSkeleton />);

    // The last skeleton in CardContent should be button-sized (h-10 w-full)
    const skeletons = container.querySelectorAll('[role="status"]');
    const lastSkeleton = skeletons[skeletons.length - 1];
    expect(lastSkeleton.className).toContain('h-10');
    expect(lastSkeleton.className).toContain('w-full');
  });
});
