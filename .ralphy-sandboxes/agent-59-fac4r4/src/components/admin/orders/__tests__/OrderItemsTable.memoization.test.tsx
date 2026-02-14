/**
 * OrderItemsTable Currency Memoization Tests
 *
 * Tests that currency totals are properly memoized using useMemo
 * to prevent unnecessary recalculations when component re-renders
 */

import { render, screen } from '@testing-library/react';
import { OrderItemsTable } from '../OrderItemsTable';
import { formatCurrency } from '@/lib/utils/formatCurrency';

const mockItems = [
  {
    id: '1',
    product_name: 'Product A',
    quantity: 2,
    unit_price: 50.00,
    total_price: 100.00,
    sku: 'SKU-A',
  },
  {
    id: '2',
    product_name: 'Product B',
    quantity: 1,
    unit_price: 75.00,
    discount_amount: 10.00,
    total_price: 65.00,
    sku: 'SKU-B',
  },
  {
    id: '3',
    product_name: 'Product C',
    quantity: 3,
    unit_price: 25.00,
    total_price: 75.00,
    sku: 'SKU-C',
  },
];

describe('OrderItemsTable - Currency Memoization', () => {
  it('renders with memoized currency totals', () => {
    render(<OrderItemsTable items={mockItems} showTotals={true} />);

    // Calculate expected totals
    const grandTotal = 100 + 65 + 75; // 240

    expect(screen.getByText(formatCurrency(grandTotal))).toBeInTheDocument();
  });

  it('recalculates memoized totals when items change', () => {
    const { rerender } = render(<OrderItemsTable items={mockItems} showTotals={true} />);

    const initialGrandTotal = formatCurrency(240);
    expect(screen.getByText(initialGrandTotal)).toBeInTheDocument();

    // Add new item
    const updatedItems = [
      ...mockItems,
      {
        id: '4',
        product_name: 'Product D',
        quantity: 1,
        unit_price: 100.00,
        total_price: 100.00,
      },
    ];

    rerender(<OrderItemsTable items={updatedItems} showTotals={true} />);

    const newGrandTotal = formatCurrency(340);
    expect(screen.getByText(newGrandTotal)).toBeInTheDocument();
  });

  it('displays individual item prices with formatCurrency', () => {
    render(<OrderItemsTable items={mockItems} />);

    // Check that each item's total_price is formatted
    expect(screen.getByText(formatCurrency(100.00))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(65.00))).toBeInTheDocument();
  });

  it('handles empty items array', () => {
    render(<OrderItemsTable items={[]} />);

    expect(screen.getByText('No items in this order')).toBeInTheDocument();
  });

  it('handles items with no discounts', () => {
    const itemsWithoutDiscounts = [
      {
        id: '1',
        product_name: 'Product A',
        quantity: 1,
        unit_price: 100.00,
        total_price: 100.00,
      },
    ];

    render(<OrderItemsTable items={itemsWithoutDiscounts} showTotals={true} />);

    // Should only show grand total, not subtotal and discount rows
    expect(screen.getByText('Grand Total')).toBeInTheDocument();
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Discount')).not.toBeInTheDocument();
  });

  it('maintains memoization when showTotals prop changes', () => {
    const { rerender } = render(<OrderItemsTable items={mockItems} showTotals={true} />);

    // Grand total should be visible
    expect(screen.getByText(formatCurrency(240))).toBeInTheDocument();

    // Hide totals
    rerender(<OrderItemsTable items={mockItems} showTotals={false} />);

    // Grand total should not be visible
    expect(screen.queryByText('Grand Total')).not.toBeInTheDocument();

    // Show totals again
    rerender(<OrderItemsTable items={mockItems} showTotals={true} />);

    // Grand total should be visible again with memoized value
    expect(screen.getByText(formatCurrency(240))).toBeInTheDocument();
  });

  it('handles decimal precision in calculations', () => {
    const itemsWithDecimals = [
      {
        id: '1',
        product_name: 'Product A',
        quantity: 3,
        unit_price: 33.33,
        total_price: 99.99,
      },
    ];

    render(<OrderItemsTable items={itemsWithDecimals} showTotals={true} />);

    // There will be two instances: one for the item total, one for the grand total
    const instances = screen.getAllByText(formatCurrency(99.99));
    expect(instances).toHaveLength(2);
  });

  it('recalculates when discount amounts change', () => {
    const { rerender } = render(<OrderItemsTable items={mockItems} showTotals={true} />);

    const initialTotal = formatCurrency(240);
    expect(screen.getByText(initialTotal)).toBeInTheDocument();

    // Update discount
    const updatedItems = mockItems.map(item =>
      item.id === '2' ? { ...item, discount_amount: 20.00, total_price: 55.00 } : item
    );

    rerender(<OrderItemsTable items={updatedItems} showTotals={true} />);

    const newTotal = formatCurrency(230);
    expect(screen.getByText(newTotal)).toBeInTheDocument();
  });
});
