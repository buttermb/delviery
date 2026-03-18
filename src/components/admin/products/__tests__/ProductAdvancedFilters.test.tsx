/**
 * ProductAdvancedFilters Component Tests
 * Tests maxPrice propagation, date picker accessibility, and filter behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ProductAdvancedFilters,
  defaultProductFilters,
} from '../ProductAdvancedFilters';

describe('ProductAdvancedFilters', () => {
  const defaultProps = {
    filters: defaultProductFilters,
    onFiltersChange: vi.fn(),
    categories: ['Flower', 'Edible', 'Concentrate'],
    vendors: ['Vendor A', 'Vendor B'],
    maxPrice: 500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filter toggle button', () => {
    render(<ProductAdvancedFilters {...defaultProps} />);
    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
  });

  it('expands filter panel on toggle click', async () => {
    const user = userEvent.setup();
    render(<ProductAdvancedFilters {...defaultProps} />);

    await user.click(screen.getByText('Advanced Filters'));

    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Vendor')).toBeInTheDocument();
    expect(screen.getByText('Stock Status')).toBeInTheDocument();
    expect(screen.getByText('Price Range')).toBeInTheDocument();
  });

  it('passes maxPrice as max attribute on price inputs', async () => {
    const user = userEvent.setup();
    render(<ProductAdvancedFilters {...defaultProps} maxPrice={999} />);

    await user.click(screen.getByText('Advanced Filters'));

    const minPriceInput = screen.getByLabelText('Minimum price');
    const maxPriceInput = screen.getByLabelText('Maximum price');

    expect(minPriceInput).toHaveAttribute('max', '999');
    expect(maxPriceInput).toHaveAttribute('max', '999');
  });

  it('uses default maxPrice of 1000 when not provided', async () => {
    const user = userEvent.setup();
    const { maxPrice: _, ...propsWithoutMaxPrice } = defaultProps;
    render(<ProductAdvancedFilters {...propsWithoutMaxPrice} />);

    await user.click(screen.getByText('Advanced Filters'));

    const minPriceInput = screen.getByLabelText('Minimum price');
    expect(minPriceInput).toHaveAttribute('max', '1000');
  });

  it('has aria-labels on date picker buttons', async () => {
    const user = userEvent.setup();
    render(<ProductAdvancedFilters {...defaultProps} />);

    await user.click(screen.getByText('Advanced Filters'));

    expect(screen.getByLabelText('Select created after date')).toBeInTheDocument();
    expect(screen.getByLabelText('Select created before date')).toBeInTheDocument();
  });

  it('has aria-labels on price inputs', async () => {
    const user = userEvent.setup();
    render(<ProductAdvancedFilters {...defaultProps} />);

    await user.click(screen.getByText('Advanced Filters'));

    expect(screen.getByLabelText('Minimum price')).toBeInTheDocument();
    expect(screen.getByLabelText('Maximum price')).toBeInTheDocument();
  });

  it('shows active filter count badge when filters are active', () => {
    render(
      <ProductAdvancedFilters
        {...defaultProps}
        filters={{ ...defaultProductFilters, category: 'Flower' }}
      />
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows filter badge with remove button that has descriptive aria-label', () => {
    render(
      <ProductAdvancedFilters
        {...defaultProps}
        filters={{ ...defaultProductFilters, category: 'Flower' }}
      />
    );

    expect(screen.getByLabelText('Remove Category: Flower filter')).toBeInTheDocument();
  });

  it('calls onFiltersChange with reset values when Clear All is clicked', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <ProductAdvancedFilters
        {...defaultProps}
        onFiltersChange={onFiltersChange}
        filters={{ ...defaultProductFilters, category: 'Flower' }}
      />
    );

    await user.click(screen.getByText('Clear All'));

    expect(onFiltersChange).toHaveBeenCalledWith(defaultProductFilters);
  });
});
