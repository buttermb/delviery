import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderTotalsCard } from '../OrderTotalsCard';
import * as React from 'react';

describe('OrderTotalsCard', () => {
  const defaultProps = {
    subtotal: 100,
    tax: 10,
    discount: 0,
    total: 110,
  };

  describe('rendering', () => {
    it('should render all totals correctly', () => {
      render(<OrderTotalsCard {...defaultProps} />);
      expect(screen.getByText('Order Totals')).toBeInTheDocument();
      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();
      expect(screen.getByText('$110.00')).toBeInTheDocument();
    });

    it('should render discount when provided', () => {
      render(<OrderTotalsCard {...defaultProps} discount={15} total={95} />);
      expect(screen.getByText('Discount')).toBeInTheDocument();
      expect(screen.getByText('-$15.00')).toBeInTheDocument();
    });

    it('should render custom discount label', () => {
      render(
        <OrderTotalsCard
          {...defaultProps}
          discount={20}
          total={90}
          discountLabel="Promo Code"
        />
      );
      expect(screen.getByText('Promo Code')).toBeInTheDocument();
      expect(screen.getByText('-$20.00')).toBeInTheDocument();
    });

    it('should render tax rate percentage', () => {
      render(<OrderTotalsCard {...defaultProps} taxRate={0.1} />);
      expect(screen.getByText(/Tax \(10\.0%\)/)).toBeInTheDocument();
    });

    it('should render in compact mode', () => {
      render(<OrderTotalsCard {...defaultProps} compact={true} />);
      expect(screen.queryByText('Order Totals')).not.toBeInTheDocument();
      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();
      expect(screen.getByText('$110.00')).toBeInTheDocument();
    });
  });

  describe('useMemo optimization', () => {
    it('should memoize formatted currency values', () => {
      const { rerender } = render(<OrderTotalsCard {...defaultProps} />);

      // Rerender with same props
      rerender(<OrderTotalsCard {...defaultProps} />);

      // Values should still be rendered
      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();
      expect(screen.getByText('$110.00')).toBeInTheDocument();
    });

    it('should recalculate when subtotal changes', () => {
      const { rerender } = render(<OrderTotalsCard {...defaultProps} />);
      expect(screen.getByText('$100.00')).toBeInTheDocument();

      rerender(<OrderTotalsCard {...defaultProps} subtotal={200} />);
      expect(screen.getByText('$200.00')).toBeInTheDocument();
      expect(screen.queryByText('$100.00')).not.toBeInTheDocument();
    });

    it('should recalculate when tax changes', () => {
      const { rerender } = render(<OrderTotalsCard {...defaultProps} />);
      expect(screen.getByText('$10.00')).toBeInTheDocument();

      rerender(<OrderTotalsCard {...defaultProps} tax={20} />);
      expect(screen.getAllByText('$20.00')).toHaveLength(1);
    });

    it('should recalculate when total changes', () => {
      const { rerender } = render(<OrderTotalsCard {...defaultProps} />);
      expect(screen.getByText('$110.00')).toBeInTheDocument();

      rerender(<OrderTotalsCard {...defaultProps} total={220} />);
      expect(screen.getByText('$220.00')).toBeInTheDocument();
    });

    it('should recalculate when discount changes', () => {
      const { rerender } = render(
        <OrderTotalsCard {...defaultProps} discount={10} total={100} />
      );
      expect(screen.getByText('-$10.00')).toBeInTheDocument();

      rerender(<OrderTotalsCard {...defaultProps} discount={20} total={90} />);
      expect(screen.getByText('-$20.00')).toBeInTheDocument();
      expect(screen.queryByText('-$10.00')).not.toBeInTheDocument();
    });

    it('should recalculate when taxRate changes', () => {
      const { rerender } = render(<OrderTotalsCard {...defaultProps} taxRate={0.1} />);
      expect(screen.getByText(/10\.0%/)).toBeInTheDocument();

      rerender(<OrderTotalsCard {...defaultProps} taxRate={0.15} />);
      expect(screen.getByText(/15\.0%/)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle zero values', () => {
      render(
        <OrderTotalsCard subtotal={0} tax={0} discount={0} total={0} />
      );
      expect(screen.getAllByText('$0.00')).toHaveLength(3); // subtotal, tax, total
    });

    it('should handle large numbers', () => {
      render(
        <OrderTotalsCard
          subtotal={10000.50}
          tax={1000.05}
          discount={0}
          total={11000.55}
        />
      );
      expect(screen.getByText('$10,000.50')).toBeInTheDocument();
      expect(screen.getByText('$1,000.05')).toBeInTheDocument();
      expect(screen.getByText('$11,000.55')).toBeInTheDocument();
    });

    it('should not show discount when discount is 0', () => {
      render(<OrderTotalsCard {...defaultProps} discount={0} />);
      expect(screen.queryByText('Discount')).not.toBeInTheDocument();
    });

    it('should handle decimal tax rates correctly', () => {
      render(<OrderTotalsCard {...defaultProps} taxRate={0.0875} />);
      expect(screen.getByText(/8\.8%/)).toBeInTheDocument();
    });
  });

  describe('compact mode', () => {
    it('should render all values in compact mode', () => {
      render(
        <OrderTotalsCard
          {...defaultProps}
          discount={5}
          total={105}
          compact={true}
        />
      );
      expect(screen.getByText('Subtotal')).toBeInTheDocument();
      expect(screen.getByText('Tax')).toBeInTheDocument();
      expect(screen.getByText('Discount')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('should apply custom className in compact mode', () => {
      const { container } = render(
        <OrderTotalsCard {...defaultProps} compact={true} className="custom-class" />
      );
      const div = container.firstChild;
      expect(div).toHaveClass('custom-class');
    });
  });
});
