/**
 * CreditBalanceAnimation Tests
 *
 * Verifies:
 * - Renders the initial value with locale formatting
 * - Shows prefix when provided
 * - Applies custom className alongside tabular-nums
 * - Updates displayed value when prop changes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CreditBalanceAnimation } from '../CreditBalanceAnimation';

// Mock framer-motion to avoid JSDOM animation issues
vi.mock('framer-motion', () => {
  const motionValue = (initial: number) => {
    let current = initial;
    const listeners = new Set<(v: number) => void>();
    return {
      get: () => current,
      set: (v: number) => {
        current = v;
        listeners.forEach((fn) => fn(v));
      },
      on: (_event: string, fn: (v: number) => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  };

  return {
    useMotionValue: (initial: number) => motionValue(initial),
    useSpring: (source: ReturnType<typeof motionValue>) => source,
    useTransform: (
      source: ReturnType<typeof motionValue>,
      transform: (v: number) => string
    ) => {
      const listeners = new Set<(v: string) => void>();
      source.on('change', (v: number) => {
        const transformed = transform(v);
        listeners.forEach((fn) => fn(transformed));
      });
      return {
        get: () => transform(source.get()),
        on: (_event: string, fn: (v: string) => void) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      };
    },
  };
});

describe('CreditBalanceAnimation', () => {
  it('renders initial value with locale formatting', () => {
    render(<CreditBalanceAnimation value={3000} />);
    expect(screen.getByText('3,000')).toBeInTheDocument();
  });

  it('renders zero value', () => {
    render(<CreditBalanceAnimation value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders large values with locale formatting', () => {
    render(<CreditBalanceAnimation value={999999} />);
    expect(screen.getByText('999,999')).toBeInTheDocument();
  });

  it('shows prefix when provided', () => {
    render(<CreditBalanceAnimation value={500} prefix="$" />);
    expect(screen.getByText('$500')).toBeInTheDocument();
  });

  it('applies tabular-nums class by default', () => {
    const { container } = render(<CreditBalanceAnimation value={100} />);
    const span = container.querySelector('span');
    expect(span).toHaveClass('tabular-nums');
  });

  it('applies custom className alongside tabular-nums', () => {
    const { container } = render(
      <CreditBalanceAnimation value={100} className="text-sm font-bold" />
    );
    const span = container.querySelector('span');
    expect(span).toHaveClass('tabular-nums');
    expect(span).toHaveClass('text-sm');
    expect(span).toHaveClass('font-bold');
  });

  it('updates displayed text when value prop changes', () => {
    const { rerender } = render(<CreditBalanceAnimation value={3000} />);
    expect(screen.getByText('3,000')).toBeInTheDocument();

    rerender(<CreditBalanceAnimation value={2975} />);
    // After rerender, the span textContent should be updated via the effect
    expect(screen.getByText('2,975')).toBeInTheDocument();
  });
});
