import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ProductFilters,
  defaultProductFilterState,
  type ProductFilterState,
} from '../ProductFilters';

function renderFilters(overrides?: {
  filters?: Partial<ProductFilterState>;
  onFilterChange?: (filters: ProductFilterState) => void;
}) {
  const onFilterChange = overrides?.onFilterChange ?? vi.fn();
  const filters = { ...defaultProductFilterState, ...overrides?.filters };
  const result = render(
    <ProductFilters filters={filters} onFilterChange={onFilterChange} />,
  );
  return { ...result, onFilterChange, filters };
}

describe('ProductFilters', () => {
  describe('rendering', () => {
    it('renders all category checkboxes', () => {
      renderFilters();
      expect(screen.getByLabelText('Flower')).toBeInTheDocument();
      expect(screen.getByLabelText('Pre-Rolls')).toBeInTheDocument();
      expect(screen.getByLabelText('Edibles')).toBeInTheDocument();
      expect(screen.getByLabelText('Vapes')).toBeInTheDocument();
      expect(screen.getByLabelText('Concentrates')).toBeInTheDocument();
    });

    it('renders stock status checkboxes', () => {
      renderFilters();
      expect(screen.getByLabelText('In Stock')).toBeInTheDocument();
      expect(screen.getByLabelText('Out of Stock')).toBeInTheDocument();
    });

    it('renders price range checkboxes', () => {
      renderFilters();
      expect(screen.getByLabelText('Under $25')).toBeInTheDocument();
      expect(screen.getByLabelText('$25 - $50')).toBeInTheDocument();
      expect(screen.getByLabelText('Over $50')).toBeInTheDocument();
    });

    it('renders section headings', () => {
      renderFilters();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Stock Status')).toBeInTheDocument();
      expect(screen.getByText('Price Range')).toBeInTheDocument();
    });
  });

  describe('controlled state', () => {
    it('reflects selected categories from props', () => {
      renderFilters({ filters: { categories: ['Flower', 'Edibles'] } });
      expect(screen.getByLabelText('Flower')).toBeChecked();
      expect(screen.getByLabelText('Edibles')).toBeChecked();
      expect(screen.getByLabelText('Pre-Rolls')).not.toBeChecked();
    });

    it('reflects selected stock statuses from props', () => {
      renderFilters({ filters: { stockStatuses: ['in_stock'] } });
      expect(screen.getByLabelText('In Stock')).toBeChecked();
      expect(screen.getByLabelText('Out of Stock')).not.toBeChecked();
    });

    it('reflects selected price ranges from props', () => {
      renderFilters({ filters: { priceRanges: ['under_25', 'over_50'] } });
      expect(screen.getByLabelText('Under $25')).toBeChecked();
      expect(screen.getByLabelText('$25 - $50')).not.toBeChecked();
      expect(screen.getByLabelText('Over $50')).toBeChecked();
    });
  });

  describe('onFilterChange callback', () => {
    it('adds category when checking a category checkbox', async () => {
      const user = userEvent.setup();
      const { onFilterChange } = renderFilters();

      await user.click(screen.getByLabelText('Flower'));

      expect(onFilterChange).toHaveBeenCalledWith({
        ...defaultProductFilterState,
        categories: ['Flower'],
      });
    });

    it('removes category when unchecking a category checkbox', async () => {
      const user = userEvent.setup();
      const { onFilterChange } = renderFilters({
        filters: { categories: ['Flower', 'Edibles'] },
      });

      await user.click(screen.getByLabelText('Flower'));

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ['Edibles'] }),
      );
    });

    it('adds stock status when checking a stock checkbox', async () => {
      const user = userEvent.setup();
      const { onFilterChange } = renderFilters();

      await user.click(screen.getByLabelText('In Stock'));

      expect(onFilterChange).toHaveBeenCalledWith({
        ...defaultProductFilterState,
        stockStatuses: ['in_stock'],
      });
    });

    it('removes stock status when unchecking a stock checkbox', async () => {
      const user = userEvent.setup();
      const { onFilterChange } = renderFilters({
        filters: { stockStatuses: ['in_stock', 'out_of_stock'] },
      });

      await user.click(screen.getByLabelText('Out of Stock'));

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ stockStatuses: ['in_stock'] }),
      );
    });

    it('adds price range when checking a price checkbox', async () => {
      const user = userEvent.setup();
      const { onFilterChange } = renderFilters();

      await user.click(screen.getByLabelText('Over $50'));

      expect(onFilterChange).toHaveBeenCalledWith({
        ...defaultProductFilterState,
        priceRanges: ['over_50'],
      });
    });

    it('removes price range when unchecking a price checkbox', async () => {
      const user = userEvent.setup();
      const { onFilterChange } = renderFilters({
        filters: { priceRanges: ['under_25', '25_to_50'] },
      });

      await user.click(screen.getByLabelText('Under $25'));

      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ priceRanges: ['25_to_50'] }),
      );
    });

    it('preserves other filter sections when changing one', async () => {
      const user = userEvent.setup();
      const initialFilters: ProductFilterState = {
        categories: ['Flower'],
        stockStatuses: ['in_stock'],
        priceRanges: ['under_25'],
      };
      const { onFilterChange } = renderFilters({ filters: initialFilters });

      await user.click(screen.getByLabelText('Edibles'));

      expect(onFilterChange).toHaveBeenCalledWith({
        categories: ['Flower', 'Edibles'],
        stockStatuses: ['in_stock'],
        priceRanges: ['under_25'],
      });
    });
  });

  describe('defaultProductFilterState', () => {
    it('has empty arrays for all filter fields', () => {
      expect(defaultProductFilterState).toEqual({
        categories: [],
        stockStatuses: [],
        priceRanges: [],
      });
    });
  });
});
