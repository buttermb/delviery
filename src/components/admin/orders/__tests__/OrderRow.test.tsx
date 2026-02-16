/**
 * OrderRow Component Tests
 * Tests the OrderRow component with React.memo optimization
 * Created: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderRow } from '../OrderRow';

// Mock dependencies
vi.mock('@/lib/utils/formatDate', () => ({
  formatSmartDate: (date: string) => new Date(date).toLocaleDateString(),
}));

vi.mock('@/components/CopyButton', () => ({
  default: ({ text, label }: any) => (
    <button data-testid="copy-button" data-text={text} aria-label={`Copy ${label}`}>
      Copy
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, size, variant, ...props }: any) => (
    <button
      onClick={onClick}
      className={className}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      data-testid="checkbox"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { onValueChange })
      )}
    </div>
  ),
  SelectTrigger: ({ children }: any) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { onValueChange })
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div
      data-testid="select-item"
      data-value={value}
      onClick={() => onValueChange?.(value)}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children, asChild: _asChild, ...props }: any) => (
    <div data-testid="dropdown-trigger" {...props}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, className }: any) => (
    <div
      data-testid="dropdown-item"
      onClick={onClick}
      className={className}
    >
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

describe('OrderRow', () => {
  const mockOrder = {
    id: 'order-123',
    order_number: 'ORD-001',
    created_at: '2024-01-15T10:30:00Z',
    status: 'pending',
    total_amount: 125.5,
    delivery_method: 'delivery',
    order_source: 'web',
    user: {
      full_name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    },
  };

  const mockHandlers = {
    onSelect: vi.fn(),
    onStatusChange: vi.fn(),
    onView: vi.fn(),
    onPrint: vi.fn(),
    onGenerateInvoice: vi.fn(),
    onCloneToB2B: vi.fn(),
    onCancel: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render order information correctly', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('ORD-001')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('$125.50')).toBeInTheDocument();
      expect(screen.getByText('delivery')).toBeInTheDocument();
    });

    it('should render checkbox with correct state', () => {
      const { rerender } = render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const checkbox = screen.getByTestId('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      rerender(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={true}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(checkbox.checked).toBe(true);
    });

    it('should display order source badge', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const badges = screen.getAllByTestId('badge');
      const sourceBadge = badges.find((badge) => badge.textContent === 'web');
      expect(sourceBadge).toBeInTheDocument();
    });

    it('should display status badge', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const badges = screen.getAllByTestId('badge');
      const statusBadge = badges.find((badge) => badge.textContent === 'pending');
      expect(statusBadge).toBeInTheDocument();
    });

    it('should render copy buttons for order number and email', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const copyButtons = screen.getAllByTestId('copy-button');
      expect(copyButtons.length).toBeGreaterThanOrEqual(2);

      const orderNumberCopy = copyButtons.find(
        (btn) => btn.getAttribute('data-text') === 'ORD-001'
      );
      const emailCopy = copyButtons.find(
        (btn) => btn.getAttribute('data-text') === 'john@example.com'
      );

      expect(orderNumberCopy).toBeInTheDocument();
      expect(emailCopy).toBeInTheDocument();
    });
  });

  describe('Order States', () => {
    it('should apply highlight styling for new orders', () => {
      const { container } = render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              isNew={true}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const row = container.querySelector('tr');
      expect(row?.className).toContain('animate-new-order-highlight');
      expect(row?.className).toContain('bg-primary/5');
    });

    it('should not apply highlight styling for regular orders', () => {
      const { container } = render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              isNew={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const row = container.querySelector('tr');
      expect(row?.className).not.toContain('animate-new-order-highlight');
    });

    it('should render different status badges correctly', () => {
      const statuses = ['pending', 'confirmed', 'preparing', 'in_transit', 'delivered', 'cancelled'];

      statuses.forEach((status) => {
        const { unmount } = render(
          <table>
            <tbody>
              <OrderRow
                order={{ ...mockOrder, status }}
                isSelected={false}
                {...mockHandlers}
              />
            </tbody>
          </table>
        );

        const badges = screen.getAllByTestId('badge');
        const statusBadge = badges.find((badge) => badge.textContent === status);
        expect(statusBadge).toBeInTheDocument();

        unmount();
      });
    });

    it('should fallback to order ID when order_number is missing', () => {
      const orderWithoutNumber = { ...mockOrder, order_number: '' };
      render(
        <table>
          <tbody>
            <OrderRow
              order={orderWithoutNumber}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText(mockOrder.id.slice(0, 8))).toBeInTheDocument();
    });

    it('should display phone when email is not available', () => {
      const orderWithPhone = {
        ...mockOrder,
        user: { full_name: 'Jane Doe', email: null, phone: '+9876543210' },
      };

      render(
        <table>
          <tbody>
            <OrderRow
              order={orderWithPhone}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('+9876543210')).toBeInTheDocument();
      expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
    });

    it('should display "Unknown Customer" when user info is missing', () => {
      const orderWithoutUser = { ...mockOrder, user: undefined };
      render(
        <table>
          <tbody>
            <OrderRow
              order={orderWithoutUser}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('Unknown Customer')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onSelect when checkbox is toggled', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const checkbox = screen.getByTestId('checkbox');
      fireEvent.click(checkbox);

      expect(mockHandlers.onSelect).toHaveBeenCalledWith(true);
    });

    it('should call onStatusChange when status is changed', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const selectItems = screen.getAllByTestId('select-item');
      const confirmedItem = selectItems.find(
        (item) => item.getAttribute('data-value') === 'confirmed'
      );

      fireEvent.click(confirmedItem!);

      expect(mockHandlers.onStatusChange).toHaveBeenCalledWith('confirmed');
    });

    it('should call onView when view button is clicked', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const viewButtons = screen.getAllByRole('button');
      const viewButton = viewButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-eye');
      });

      fireEvent.click(viewButton!);

      expect(mockHandlers.onView).toHaveBeenCalled();
    });

    it('should call onPrint when print menu item is clicked', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const printItem = dropdownItems.find((item) =>
        item.textContent?.includes('Print Order')
      );

      fireEvent.click(printItem!);

      expect(mockHandlers.onPrint).toHaveBeenCalled();
    });

    it('should call onGenerateInvoice when invoice menu item is clicked', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const invoiceItem = dropdownItems.find((item) =>
        item.textContent?.includes('Generate Invoice')
      );

      fireEvent.click(invoiceItem!);

      expect(mockHandlers.onGenerateInvoice).toHaveBeenCalled();
    });

    it('should call onCloneToB2B when clone menu item is clicked', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const cloneItem = dropdownItems.find((item) =>
        item.textContent?.includes('Clone to B2B')
      );

      fireEvent.click(cloneItem!);

      expect(mockHandlers.onCloneToB2B).toHaveBeenCalled();
    });

    it('should call onCancel when cancel menu item is clicked', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const cancelItem = dropdownItems.find((item) =>
        item.textContent?.includes('Cancel Order')
      );

      fireEvent.click(cancelItem!);

      expect(mockHandlers.onCancel).toHaveBeenCalled();
    });

    it('should call onDelete when delete menu item is clicked', () => {
      render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const deleteItem = dropdownItems.find((item) =>
        item.textContent?.includes('Delete Order')
      );

      fireEvent.click(deleteItem!);

      expect(mockHandlers.onDelete).toHaveBeenCalled();
    });

    it('should not show cancel option when order is already cancelled', () => {
      const cancelledOrder = { ...mockOrder, status: 'cancelled' };
      render(
        <table>
          <tbody>
            <OrderRow
              order={cancelledOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const cancelItem = dropdownItems.find((item) =>
        item.textContent?.includes('Cancel Order')
      );

      expect(cancelItem).toBeUndefined();
    });
  });

  describe('React.memo Optimization', () => {
    it('should be a memoized component', () => {
      // Check if the component is wrapped with React.memo
      expect(OrderRow.$$typeof).toBe(Symbol.for('react.memo'));
    });

    it('should have displayName set correctly', () => {
      expect(OrderRow.displayName).toBe('OrderRow');
    });

    it('should re-render when order prop changes', () => {
      const { rerender } = render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('ORD-001')).toBeInTheDocument();

      const updatedOrder = { ...mockOrder, order_number: 'ORD-002' };
      rerender(
        <table>
          <tbody>
            <OrderRow
              order={updatedOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('ORD-002')).toBeInTheDocument();
      expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
    });

    it('should re-render when isSelected prop changes', () => {
      const { rerender } = render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const checkbox = screen.getByTestId('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      rerender(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={true}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(checkbox.checked).toBe(true);
    });

    it('should re-render when handler props change', () => {
      const { rerender } = render(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const newOnView = vi.fn();
      rerender(
        <table>
          <tbody>
            <OrderRow
              order={mockOrder}
              isSelected={false}
              {...mockHandlers}
              onView={newOnView}
            />
          </tbody>
        </table>
      );

      const viewButtons = screen.getAllByRole('button');
      const viewButton = viewButtons.find((btn) => {
        const svg = btn.querySelector('svg');
        return svg?.classList.contains('lucide-eye');
      });

      fireEvent.click(viewButton!);

      expect(newOnView).toHaveBeenCalled();
      expect(mockHandlers.onView).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing delivery method', () => {
      const orderWithoutMethod = { ...mockOrder, delivery_method: undefined };
      render(
        <table>
          <tbody>
            <OrderRow
              order={orderWithoutMethod}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('should handle missing order source', () => {
      const orderWithoutSource = { ...mockOrder, order_source: undefined };
      render(
        <table>
          <tbody>
            <OrderRow
              order={orderWithoutSource}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      const badges = screen.getAllByTestId('badge');
      const sourceBadge = badges.find((badge) => badge.textContent === 'admin');
      expect(sourceBadge).toBeInTheDocument();
    });

    it('should format total amount with two decimal places', () => {
      const orderWithWholeNumber = { ...mockOrder, total_amount: 100 };
      render(
        <table>
          <tbody>
            <OrderRow
              order={orderWithWholeNumber}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });

    it('should handle zero total amount', () => {
      const orderWithZero = { ...mockOrder, total_amount: 0 };
      render(
        <table>
          <tbody>
            <OrderRow
              order={orderWithZero}
              isSelected={false}
              {...mockHandlers}
            />
          </tbody>
        </table>
      );

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should stop propagation on checkbox click', () => {
      const rowClickHandler = vi.fn();
      const { container } = render(
        <table>
          <tbody>
            <tr onClick={rowClickHandler}>
              <OrderRow
                order={mockOrder}
                isSelected={false}
                {...mockHandlers}
              />
            </tr>
          </tbody>
        </table>
      );

      const checkboxContainer = container.querySelector('td:first-child div');
      fireEvent.click(checkboxContainer!);

      // The row click handler should not be called because propagation is stopped
      expect(rowClickHandler).not.toHaveBeenCalled();
    });
  });
});
