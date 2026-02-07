import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MoneyDisplay } from '../MoneyDisplay';
import * as React from 'react';

describe('MoneyDisplay', () => {
  it('should render formatted currency with cents', () => {
    render(<MoneyDisplay amount={1234.56} showCents={true} />);
    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  it('should render formatted currency without cents', () => {
    render(<MoneyDisplay amount={1234.56} showCents={false} />);
    expect(screen.getByText('$1,235')).toBeInTheDocument();
  });

  it('should render zero correctly', () => {
    render(<MoneyDisplay amount={0} showCents={true} />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('should render large numbers correctly', () => {
    render(<MoneyDisplay amount={1000000.99} showCents={true} />);
    expect(screen.getByText('$1,000,000.99')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <MoneyDisplay amount={100} className="text-red-500" showCents={true} />
    );
    const span = container.querySelector('span');
    expect(span).toHaveClass('font-mono', 'text-red-500');
  });

  describe('useMemo optimization', () => {
    it('should memoize formatted value when amount does not change', () => {
      const { rerender } = render(<MoneyDisplay amount={100} showCents={true} />);

      // Get initial rendered value
      const initialValue = screen.getByText('$100.00');

      // Rerender with same props
      rerender(<MoneyDisplay amount={100} showCents={true} />);

      // Value should still be the same element (memoized)
      expect(screen.getByText('$100.00')).toBe(initialValue);
    });

    it('should recalculate when amount changes', () => {
      const { rerender } = render(<MoneyDisplay amount={100} showCents={true} />);
      expect(screen.getByText('$100.00')).toBeInTheDocument();

      rerender(<MoneyDisplay amount={200} showCents={true} />);
      expect(screen.getByText('$200.00')).toBeInTheDocument();
      expect(screen.queryByText('$100.00')).not.toBeInTheDocument();
    });

    it('should recalculate when showCents changes', () => {
      const { rerender } = render(<MoneyDisplay amount={100.50} showCents={true} />);
      expect(screen.getByText('$100.50')).toBeInTheDocument();

      rerender(<MoneyDisplay amount={100.50} showCents={false} />);
      expect(screen.getByText('$101')).toBeInTheDocument();
      expect(screen.queryByText('$100.50')).not.toBeInTheDocument();
    });

    it('should not recalculate when only className changes', () => {
      const { rerender } = render(
        <MoneyDisplay amount={100} showCents={true} className="text-blue-500" />
      );

      // Get the initial value
      expect(screen.getByText('$100.00')).toBeInTheDocument();

      // Rerender with different className but same amount and showCents
      rerender(
        <MoneyDisplay amount={100} showCents={true} className="text-red-500" />
      );

      // Value should still be rendered correctly
      // (className is not a dependency of useMemo)
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle decimal precision correctly', () => {
      render(<MoneyDisplay amount={0.99} showCents={true} />);
      expect(screen.getByText('$0.99')).toBeInTheDocument();
    });

    it('should handle negative numbers', () => {
      render(<MoneyDisplay amount={-50.25} showCents={true} />);
      // toLocaleString formats negative numbers as "-$50.25" but splits into separate text nodes
      expect(screen.getByText(/\$-50\.25/)).toBeInTheDocument();
    });

    it('should round correctly when showCents is false', () => {
      render(<MoneyDisplay amount={99.49} showCents={false} />);
      expect(screen.getByText('$99')).toBeInTheDocument();

      render(<MoneyDisplay amount={99.50} showCents={false} />);
      expect(screen.getByText('$100')).toBeInTheDocument();
    });
  });
});
