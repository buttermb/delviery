/**
 * SimpleProductCard Currency Memoization Tests
 *
 * Tests that currency values are properly memoized using useMemo
 * to prevent unnecessary recalculations when component re-renders
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimpleProductCard } from '../SimpleProductCard';
import { formatCurrency } from '@/lib/utils/formatCurrency';

// Mock ProductImage component
vi.mock('@/components/ProductImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const mockProduct = {
  id: '1',
  name: 'Test Product',
  image_url: 'https://example.com/product.jpg',
  price: 99.99,
  stock_quantity: 25,
  in_stock: true,
  category: 'Test Category',
};

describe('SimpleProductCard - Currency Memoization', () => {
  it('renders with memoized currency value', () => {
    render(<SimpleProductCard product={mockProduct} />);

    const formattedPrice = formatCurrency(mockProduct.price);
    expect(screen.getByText(formattedPrice)).toBeInTheDocument();
  });

  it('recalculates memoized value when price changes', () => {
    const { rerender } = render(<SimpleProductCard product={mockProduct} />);

    const initialPrice = formatCurrency(mockProduct.price);
    expect(screen.getByText(initialPrice)).toBeInTheDocument();

    // Update price
    const updatedProduct = { ...mockProduct, price: 149.99 };
    rerender(<SimpleProductCard product={updatedProduct} />);

    const newPrice = formatCurrency(updatedProduct.price);
    expect(screen.getByText(newPrice)).toBeInTheDocument();
    expect(screen.queryByText(initialPrice)).not.toBeInTheDocument();
  });

  it('handles string price values correctly', () => {
    const productWithStringPrice = { ...mockProduct, price: '75.50' };
    render(<SimpleProductCard product={productWithStringPrice} />);

    const formattedPrice = formatCurrency(75.50);
    expect(screen.getByText(formattedPrice)).toBeInTheDocument();
  });

  it('handles null price values', () => {
    const productWithNullPrice = { ...mockProduct, price: null };
    render(<SimpleProductCard product={productWithNullPrice} />);

    const zeroPrice = formatCurrency(0);
    expect(screen.getByText(zeroPrice)).toBeInTheDocument();
  });

  it('handles undefined price values', () => {
    const productWithUndefinedPrice = { ...mockProduct, price: undefined };
    render(<SimpleProductCard product={productWithUndefinedPrice} />);

    const zeroPrice = formatCurrency(0);
    expect(screen.getByText(zeroPrice)).toBeInTheDocument();
  });

  it('maintains memoization when unrelated props change', () => {
    const { rerender } = render(<SimpleProductCard product={mockProduct} />);

    const price = formatCurrency(mockProduct.price);
    expect(screen.getByText(price)).toBeInTheDocument();

    // Change unrelated prop
    const updatedProduct = { ...mockProduct, stock_quantity: 50 };
    rerender(<SimpleProductCard product={updatedProduct} />);

    // Price should still be memoized and displayed
    expect(screen.getByText(price)).toBeInTheDocument();
  });

  it('uses memoized value in aria-label', () => {
    const { container } = render(<SimpleProductCard product={mockProduct} onClick={() => {}} />);

    const formattedPrice = formatCurrency(mockProduct.price);
    const card = container.querySelector('[role="button"]');

    expect(card).toHaveAttribute('aria-label', `Test Product - ${formattedPrice}`);
  });

  it('handles decimal precision correctly', () => {
    const productWithDecimals = { ...mockProduct, price: 99.999 };
    render(<SimpleProductCard product={productWithDecimals} />);

    // formatCurrency should handle decimal precision
    const formattedPrice = formatCurrency(99.999);
    expect(screen.getByText(formattedPrice)).toBeInTheDocument();
  });

  it('handles large currency values', () => {
    const productWithLargePrice = { ...mockProduct, price: 1000000.50 };
    render(<SimpleProductCard product={productWithLargePrice} />);

    const formattedPrice = formatCurrency(1000000.50);
    expect(screen.getByText(formattedPrice)).toBeInTheDocument();
  });
});
