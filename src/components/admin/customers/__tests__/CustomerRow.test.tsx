/**
 * CustomerRow Component Tests
 * Tests the CustomerRow component with React.memo optimization
 * Created: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CustomerRow from '../CustomerRow';

// Mock dependencies
vi.mock('@/components/CopyButton', () => ({
  default: ({ text, label }: { text: string; label: string }) => (
    <button data-testid="copy-button" data-text={text} aria-label={`Copy ${label}`}>
      Copy
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: { children?: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, size, variant, asChild: _asChild, ...props }: { children?: React.ReactNode; onClick?: () => void; className?: string; size?: string; variant?: string; asChild?: boolean; [key: string]: unknown }) => (
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

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children, asChild: _asChild, ...props }: { children?: React.ReactNode; asChild?: boolean; [key: string]: unknown }) => (
    <div data-testid="dropdown-trigger" {...props}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, className }: { children?: React.ReactNode; onClick?: () => void; className?: string }) => (
    <div
      data-testid="dropdown-item"
      onClick={onClick}
      className={className}
    >
      {children}
    </div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('CustomerRow', () => {
  const mockCustomer = {
    id: 'customer-123',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    customer_type: 'medical',
    total_spent: 1250.75,
    loyalty_points: 150,
    loyalty_tier: 'gold',
    last_purchase_at: '2024-01-15T10:30:00Z',
    status: 'active',
    medical_card_expiration: '2025-12-31',
  };

  const mockHandlers = {
    onSelectChange: vi.fn(),
    onDeleteClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderCustomerRow = (props = {}) => {
    return render(
      <BrowserRouter>
        <table>
          <tbody>
            <CustomerRow
              customer={mockCustomer}
              isSelected={false}
              tenantSlug="test-tenant"
              {...mockHandlers}
              {...props}
            />
          </tbody>
        </table>
      </BrowserRouter>
    );
  };

  describe('Basic Rendering', () => {
    it('should render customer information correctly', () => {
      renderCustomerRow();

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('$1250.75')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });

    it('should render customer initials in avatar', () => {
      renderCustomerRow();

      const avatar = screen.getByText('JD');
      expect(avatar).toBeInTheDocument();
    });

    it('should render checkbox with correct state', () => {
      const { rerender } = render(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={mockCustomer}
                isSelected={false}
                tenantSlug="test-tenant"
                {...mockHandlers}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      rerender(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={mockCustomer}
                isSelected={true}
                tenantSlug="test-tenant"
                {...mockHandlers}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      expect(checkbox.checked).toBe(true);
    });

    it('should display customer type badge for medical customers', () => {
      renderCustomerRow();

      const badges = screen.getAllByTestId('badge');
      const medicalBadge = badges.find((badge) => badge.textContent === 'Medical');
      expect(medicalBadge).toBeInTheDocument();
      expect(medicalBadge?.getAttribute('data-variant')).toBe('default');
    });

    it('should display customer type badge for recreational customers', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, customer_type: 'recreational' },
      });

      const badges = screen.getAllByTestId('badge');
      const recBadge = badges.find((badge) => badge.textContent === 'Recreational');
      expect(recBadge).toBeInTheDocument();
      expect(recBadge?.getAttribute('data-variant')).toBe('secondary');
    });

    it('should render copy button for email', () => {
      renderCustomerRow();

      const copyButtons = screen.getAllByTestId('copy-button');
      const emailCopy = copyButtons.find(
        (btn) => btn.getAttribute('data-text') === 'john@example.com'
      );

      expect(emailCopy).toBeInTheDocument();
    });

    it('should display formatted last purchase date', () => {
      renderCustomerRow();

      const date = new Date('2024-01-15T10:30:00Z').toLocaleDateString();
      expect(screen.getByText(date)).toBeInTheDocument();
    });

    it('should display "Never" when customer has not made a purchase', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, last_purchase_at: null },
      });

      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  describe('Customer Status Badge', () => {
    it('should show "New" badge when customer has not made a purchase', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, last_purchase_at: null },
      });

      const badges = screen.getAllByTestId('badge');
      const newBadge = badges.find((badge) => badge.textContent === 'New');
      expect(newBadge).toBeInTheDocument();
      expect(newBadge?.getAttribute('data-variant')).toBe('outline');
    });

    it('should show "Active" badge for recent purchases (within 7 days)', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      renderCustomerRow({
        customer: { ...mockCustomer, last_purchase_at: recentDate.toISOString() },
      });

      const badges = screen.getAllByTestId('badge');
      const activeBadge = badges.find((badge) => badge.textContent === 'Active');
      expect(activeBadge).toBeInTheDocument();
    });

    it('should show "Regular" badge for moderate purchases (8-60 days)', () => {
      const moderateDate = new Date();
      moderateDate.setDate(moderateDate.getDate() - 30);

      renderCustomerRow({
        customer: { ...mockCustomer, last_purchase_at: moderateDate.toISOString() },
      });

      const badges = screen.getAllByTestId('badge');
      const regularBadge = badges.find((badge) => badge.textContent === 'Regular');
      expect(regularBadge).toBeInTheDocument();
      expect(regularBadge?.getAttribute('data-variant')).toBe('secondary');
    });

    it('should show "At Risk" badge for old purchases (over 60 days)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 90);

      renderCustomerRow({
        customer: { ...mockCustomer, last_purchase_at: oldDate.toISOString() },
      });

      const badges = screen.getAllByTestId('badge');
      const atRiskBadge = badges.find((badge) => badge.textContent === 'At Risk');
      expect(atRiskBadge).toBeInTheDocument();
      expect(atRiskBadge?.getAttribute('data-variant')).toBe('destructive');
    });
  });

  describe('Encrypted Data Display', () => {
    it('should show encrypted indicator when customer data is encrypted', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, _encryptedIndicator: true },
      });

      expect(screen.getByText('Encrypted')).toBeInTheDocument();
    });

    it('should not show copy button when data is encrypted', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, _encryptedIndicator: true },
      });

      const copyButtons = screen.queryAllByTestId('copy-button');
      const emailCopy = copyButtons.find(
        (btn) => btn.getAttribute('data-text') === 'john@example.com'
      );

      expect(emailCopy).toBeUndefined();
    });

    it('should show fallback text when no contact info is available', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, email: null, phone: null },
      });

      expect(screen.getByText('No contact')).toBeInTheDocument();
    });

    it('should show phone when email is not available', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, email: null },
      });

      expect(screen.getByText('+1234567890')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onSelectChange when checkbox is toggled', () => {
      renderCustomerRow();

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockHandlers.onSelectChange).toHaveBeenCalledWith('customer-123', true);
    });

    it('should call onSelectChange with false when unchecking', () => {
      renderCustomerRow({ isSelected: true });

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      expect(mockHandlers.onSelectChange).toHaveBeenCalledWith('customer-123', false);
    });

    it('should navigate to customer details when "View Details" is clicked', () => {
      renderCustomerRow();

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const viewItem = dropdownItems.find((item) =>
        item.textContent?.includes('View Details')
      );

      fireEvent.click(viewItem!);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/customers/customer-123');
    });

    it('should navigate to edit page when "Edit" is clicked', () => {
      renderCustomerRow();

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const editItem = dropdownItems.find((item) =>
        item.textContent?.includes('Edit')
      );

      fireEvent.click(editItem!);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/customer-management/customer-123/edit');
    });

    it('should navigate to POS with customer ID when "New Order" is clicked', () => {
      renderCustomerRow();

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const newOrderItem = dropdownItems.find((item) =>
        item.textContent?.includes('New Order')
      );

      fireEvent.click(newOrderItem!);

      expect(mockNavigate).toHaveBeenCalledWith('/test-tenant/admin/pos?customer=customer-123');
    });

    it('should call onDeleteClick when "Delete" is clicked', () => {
      renderCustomerRow();

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const deleteItem = dropdownItems.find((item) =>
        item.textContent?.includes('Delete')
      );

      fireEvent.click(deleteItem!);

      expect(mockHandlers.onDeleteClick).toHaveBeenCalledWith('customer-123', 'John Doe');
    });

    it('should not navigate when tenantSlug is undefined', () => {
      renderCustomerRow({ tenantSlug: undefined });

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const viewItem = dropdownItems.find((item) =>
        item.textContent?.includes('View Details')
      );

      fireEvent.click(viewItem!);

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('React.memo Optimization', () => {
    it('should be a memoized component', () => {
      // Check if the component is wrapped with React.memo
      expect(CustomerRow.$$typeof).toBe(Symbol.for('react.memo'));
    });

    it('should re-render when customer prop changes', () => {
      const { rerender } = render(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={mockCustomer}
                isSelected={false}
                tenantSlug="test-tenant"
                {...mockHandlers}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();

      const updatedCustomer = { ...mockCustomer, first_name: 'Jane', last_name: 'Smith' };
      rerender(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={updatedCustomer}
                isSelected={false}
                tenantSlug="test-tenant"
                {...mockHandlers}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('should re-render when isSelected prop changes', () => {
      const { rerender } = render(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={mockCustomer}
                isSelected={false}
                tenantSlug="test-tenant"
                {...mockHandlers}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      rerender(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={mockCustomer}
                isSelected={true}
                tenantSlug="test-tenant"
                {...mockHandlers}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      expect(checkbox.checked).toBe(true);
    });

    it('should re-render when handler props change', () => {
      const { rerender } = render(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={mockCustomer}
                isSelected={false}
                tenantSlug="test-tenant"
                {...mockHandlers}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      const newOnDeleteClick = vi.fn();
      rerender(
        <BrowserRouter>
          <table>
            <tbody>
              <CustomerRow
                customer={mockCustomer}
                isSelected={false}
                tenantSlug="test-tenant"
                onSelectChange={mockHandlers.onSelectChange}
                onDeleteClick={newOnDeleteClick}
              />
            </tbody>
          </table>
        </BrowserRouter>
      );

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const deleteItem = dropdownItems.find((item) =>
        item.textContent?.includes('Delete')
      );

      fireEvent.click(deleteItem!);

      expect(newOnDeleteClick).toHaveBeenCalled();
      expect(mockHandlers.onDeleteClick).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing customer name gracefully', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, first_name: '', last_name: '' },
      });

      // Avatar should show empty or fallback
      expect(screen.queryByText('JD')).not.toBeInTheDocument();
    });

    it('should handle zero total spent', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, total_spent: 0 },
      });

      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('should handle zero loyalty points', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, loyalty_points: 0 },
      });

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should format total spent with two decimal places', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, total_spent: 100 },
      });

      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });

    it('should handle partial customer names', () => {
      renderCustomerRow({
        customer: { ...mockCustomer, last_name: '' },
      });

      expect(screen.getByText(/^John/)).toBeInTheDocument();
    });
  });
});
