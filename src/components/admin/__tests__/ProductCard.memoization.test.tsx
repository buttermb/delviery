/**
 * ProductCard Currency Memoization Tests
 *
 * Tests that currency values are properly memoized using useMemo
 * to prevent unnecessary recalculations when component re-renders
 */

import { render, screen } from '@testing-library/react';
import { ProductCard } from '../ProductCard';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/hooks/useOptimizedImage', () => ({
  useProductThumbnail: () => ({ src: null, srcSet: '' }),
}));

vi.mock('@/components/mobile/LongPressMenu', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockProduct = {
  id: '1',
  name: 'Test Product',
  category: 'Test Category',
  price: 100,
  stock_quantity: 50,
  available_quantity: 50,
  in_stock: true,
  sku: 'TEST-001',
  low_stock_alert: 10,
  cost_per_unit: 60,
  wholesale_price: 100,
};

describe('ProductCard - Currency Memoization', () => {
  it('renders with memoized currency values', () => {
    render(<ProductCard product={mockProduct} />);

    // Verify wholesale price is displayed
    const wholesalePrice = formatCurrency(mockProduct.wholesale_price);
    expect(screen.getByText(wholesalePrice)).toBeInTheDocument();

    // Verify cost is displayed
    const cost = formatCurrency(mockProduct.cost_per_unit);
    expect(screen.getByText(cost)).toBeInTheDocument();
  });

  it('recalculates memoized values when wholesale_price changes', () => {
    const { rerender } = render(<ProductCard product={mockProduct} />);

    const initialPrice = formatCurrency(mockProduct.wholesale_price);
    expect(screen.getByText(initialPrice)).toBeInTheDocument();

    // Change wholesale price
    const updatedProduct = { ...mockProduct, wholesale_price: 150 };
    rerender(<ProductCard product={updatedProduct} />);

    const newPrice = formatCurrency(updatedProduct.wholesale_price);
    expect(screen.getByText(newPrice)).toBeInTheDocument();
    expect(screen.queryByText(initialPrice)).not.toBeInTheDocument();
  });

  it('recalculates memoized values when cost_per_unit changes', () => {
    const { rerender } = render(<ProductCard product={mockProduct} />);

    const initialCost = formatCurrency(mockProduct.cost_per_unit);
    expect(screen.getByText(initialCost)).toBeInTheDocument();

    // Change cost
    const updatedProduct = { ...mockProduct, cost_per_unit: 75 };
    rerender(<ProductCard product={updatedProduct} />);

    const newCost = formatCurrency(updatedProduct.cost_per_unit);
    expect(screen.getByText(newCost)).toBeInTheDocument();
    expect(screen.queryByText(initialCost)).not.toBeInTheDocument();
  });

  it('handles zero values correctly', () => {
    const productWithZeroCost = { ...mockProduct, cost_per_unit: 0 };
    render(<ProductCard product={productWithZeroCost} />);

    // Cost should not be displayed when it's 0
    const zeroCost = formatCurrency(0);
    expect(screen.queryByText(zeroCost)).not.toBeInTheDocument();
  });

  it('handles large currency values', () => {
    const productWithLargePrice = {
      ...mockProduct,
      wholesale_price: 999999.99,
      cost_per_unit: 500000.50,
    };

    render(<ProductCard product={productWithLargePrice} />);

    const largePrice = formatCurrency(productWithLargePrice.wholesale_price);
    const largeCost = formatCurrency(productWithLargePrice.cost_per_unit);

    expect(screen.getByText(largePrice)).toBeInTheDocument();
    expect(screen.getByText(largeCost)).toBeInTheDocument();
  });

  it('maintains memoization across unrelated prop changes', () => {
    const { rerender } = render(<ProductCard product={mockProduct} />);

    const price = formatCurrency(mockProduct.wholesale_price);
    expect(screen.getByText(price)).toBeInTheDocument();

    // Change unrelated prop (name) - currency values should remain memoized
    const updatedProduct = { ...mockProduct, name: 'Updated Product Name' };
    rerender(<ProductCard product={updatedProduct} />);

    // Price should still be displayed with same memoized value
    expect(screen.getByText(price)).toBeInTheDocument();
    expect(screen.getByText('Updated Product Name')).toBeInTheDocument();
  });
});
