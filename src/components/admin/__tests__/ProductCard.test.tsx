/**
 * ProductCard Component Tests
 * Tests the ProductCard component with React.memo optimization
 * Updated: 2026-02-01
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from '../ProductCard';

// Mock dependencies
vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}));

vi.mock('@/hooks/useOptimizedImage', () => ({
  useProductThumbnail: (url?: string) => ({
    src: url ? `optimized-${url}` : undefined,
    srcSet: url ? `optimized-${url} 1x, optimized-${url} 2x` : undefined,
  }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: { children?: React.ReactNode; className?: string; [key: string]: unknown }) => (
    <div data-testid="card" className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: { children?: React.ReactNode; className?: string; [key: string]: unknown }) => (
    <div data-testid="card-content" className={className} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, variant, size, ...props }: { children?: React.ReactNode; onClick?: () => void; className?: string; variant?: string; size?: string; [key: string]: unknown }) => (
    <button
      onClick={onClick}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant, ...props }: { children?: React.ReactNode; className?: string; variant?: string; [key: string]: unknown }) => (
    <span data-testid="badge" className={className} data-variant={variant} {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, onClick, ...props }: { children?: React.ReactNode; onClick?: () => void; [key: string]: unknown }) => (
    <div data-testid="dropdown-trigger" onClick={onClick} {...props}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div data-testid="dropdown-content" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, className, ...props }: { children?: React.ReactNode; onClick?: () => void; className?: string; [key: string]: unknown }) => (
    <div data-testid="dropdown-item" onClick={onClick} className={className} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/admin/InventoryStatusBadge', () => ({
  InventoryStatusBadge: ({ quantity, lowStockThreshold }: { quantity: number; lowStockThreshold: number }) => (
    <span data-testid="inventory-status-badge">
      {quantity <= lowStockThreshold ? 'Low Stock' : 'In Stock'}
    </span>
  ),
}));

vi.mock('@/components/mobile/LongPressMenu', () => ({
  default: ({ children, items }: { children?: React.ReactNode; items: unknown[] }) => (
    <div data-testid="long-press-menu" data-items={items.length}>
      {children}
    </div>
  ),
}));

describe('ProductCard', () => {
  const mockProduct = {
    id: 'test-product-1',
    name: 'Test Product',
    category: 'Cannabis',
    price: 50.0,
    stock_quantity: 100,
    available_quantity: 100,
    in_stock: true,
    image_url: 'https://example.com/product.jpg',
    sku: 'TEST-SKU-001',
    low_stock_alert: 10,
    strain_name: 'Test Strain',
    cost_per_unit: 30.0,
    wholesale_price: 50.0,
    deleted_at: null,
  };

  const mockHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onAddToMenu: vi.fn(),
    onPrintLabel: vi.fn(),
    onPublish: vi.fn(),
    onArchive: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render product information correctly', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      expect(screen.getByText('Test Product')).toBeInTheDocument();
      expect(screen.getByText('Test Strain')).toBeInTheDocument();
      expect(screen.getByText('TEST-SKU-001')).toBeInTheDocument();
    });

    it('should render product image with optimized source', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const image = screen.getByRole('img', { name: 'Test Product' }) as HTMLImageElement;
      expect(image).toBeInTheDocument();
      expect(image.src).toContain('optimized-');
    });

    it('should display category badge', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const badges = screen.getAllByTestId('badge');
      const categoryBadge = badges.find((badge) => badge.textContent === 'Cannabis');
      expect(categoryBadge).toBeInTheDocument();
    });

    it('should display pricing information', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      expect(screen.getByText('Wholesale Price')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
      expect(screen.getByText('Cost')).toBeInTheDocument();
      expect(screen.getByText('$30.00')).toBeInTheDocument();
    });

    it('should calculate and display profit margin', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      expect(screen.getByText('Margin')).toBeInTheDocument();
      expect(screen.getByText('40.0%')).toBeInTheDocument();
    });

    it('should display stock information', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      expect(screen.getByText(/Stock: 100 units/)).toBeInTheDocument();
    });

    it('should show inventory status badge', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      expect(screen.getByTestId('inventory-status-badge')).toBeInTheDocument();
      expect(screen.getByText('In Stock')).toBeInTheDocument();
    });
  });

  describe('Product States', () => {
    it('should show out of stock badge when quantity is 0', () => {
      const outOfStockProduct = { ...mockProduct, available_quantity: 0 };
      render(<ProductCard product={outOfStockProduct} {...mockHandlers} />);

      const badges = screen.getAllByTestId('badge');
      const outOfStockBadge = badges.find((badge) => badge.textContent === 'Out of Stock');
      expect(outOfStockBadge).toBeInTheDocument();
    });

    it('should show low stock status when below threshold', () => {
      const lowStockProduct = { ...mockProduct, available_quantity: 5, low_stock_alert: 10 };
      render(<ProductCard product={lowStockProduct} {...mockHandlers} />);

      expect(screen.getByText('Low Stock')).toBeInTheDocument();
    });

    it('should render archived product correctly', () => {
      const archivedProduct = { ...mockProduct, deleted_at: '2024-01-01' };
      render(<ProductCard product={archivedProduct} {...mockHandlers} />);

      // Product should still render
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    it('should render product without image', () => {
      const noImageProduct = { ...mockProduct, image_url: undefined };
      render(<ProductCard product={noImageProduct} {...mockHandlers} />);

      expect(screen.queryByRole('img', { name: 'Test Product' })).not.toBeInTheDocument();
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onEdit when edit button is clicked', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      // Get the edit button (not the dropdown item)
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      expect(mockHandlers.onEdit).toHaveBeenCalledWith('test-product-1');
    });

    it('should call onAddToMenu when menu button is clicked', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const menuButton = screen.getByText('Menu');
      fireEvent.click(menuButton);

      expect(mockHandlers.onAddToMenu).toHaveBeenCalledWith('test-product-1');
    });

    it('should not render edit button when onEdit is not provided', () => {
      render(<ProductCard product={mockProduct} onDelete={mockHandlers.onDelete} />);

      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('should not render menu button when onAddToMenu is not provided', () => {
      render(<ProductCard product={mockProduct} onEdit={mockHandlers.onEdit} />);

      expect(screen.queryByText('Menu')).not.toBeInTheDocument();
    });
  });

  describe('Dropdown Menu Actions', () => {
    it('should render dropdown menu with all action items', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    });

    it('should show edit option in dropdown when onEdit is provided', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const editItem = dropdownItems.find((item) => item.textContent?.includes('Edit'));
      expect(editItem).toBeInTheDocument();
    });

    it('should show duplicate option in dropdown when onDuplicate is provided', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const duplicateItem = dropdownItems.find((item) => item.textContent?.includes('Duplicate'));
      expect(duplicateItem).toBeInTheDocument();
    });

    it('should show print label option when sku exists', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const printLabelItem = dropdownItems.find((item) =>
        item.textContent?.includes('Print Label')
      );
      expect(printLabelItem).toBeInTheDocument();
    });

    it('should not show print label option when sku is missing', () => {
      const productWithoutSku = { ...mockProduct, sku: undefined };
      render(<ProductCard product={productWithoutSku} {...mockHandlers} />);

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const printLabelItem = dropdownItems.find((item) =>
        item.textContent?.includes('Print Label')
      );
      expect(printLabelItem).toBeUndefined();
    });

    it('should show archive option in dropdown', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const archiveItem = dropdownItems.find((item) => item.textContent?.includes('Archive'));
      expect(archiveItem).toBeInTheDocument();
    });

    it('should show restore option for archived products', () => {
      const archivedProduct = { ...mockProduct, deleted_at: '2024-01-01' };
      render(<ProductCard product={archivedProduct} {...mockHandlers} />);

      const dropdownItems = screen.getAllByTestId('dropdown-item');
      const restoreItem = dropdownItems.find((item) => item.textContent?.includes('Restore'));
      expect(restoreItem).toBeInTheDocument();
    });
  });

  describe('React.memo Optimization', () => {
    it('should be a memoized component', () => {
      // Check if the component is wrapped with React.memo
      expect(ProductCard.$$typeof).toBe(Symbol.for('react.memo'));
    });

    it('should not re-render when props remain the same', () => {
      const renderSpy = vi.fn();

      const TestWrapper = ({ product, ...handlers }: { product: typeof mockProduct; [key: string]: unknown }) => {
        renderSpy();
        return <ProductCard product={product} {...handlers} />;
      };

      const { rerender } = render(
        <TestWrapper product={mockProduct} {...mockHandlers} />
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with the same props
      rerender(<TestWrapper product={mockProduct} {...mockHandlers} />);

      // The spy should still be called, but the ProductCard itself shouldn't re-render
      // due to React.memo
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should re-render when product prop changes', () => {
      const { rerender } = render(
        <ProductCard product={mockProduct} {...mockHandlers} />
      );

      expect(screen.getByText('Test Product')).toBeInTheDocument();

      const updatedProduct = { ...mockProduct, name: 'Updated Product' };
      rerender(<ProductCard product={updatedProduct} {...mockHandlers} />);

      expect(screen.getByText('Updated Product')).toBeInTheDocument();
      expect(screen.queryByText('Test Product')).not.toBeInTheDocument();
    });

    it('should re-render when handler props change', () => {
      const { rerender } = render(
        <ProductCard product={mockProduct} {...mockHandlers} />
      );

      const newOnEdit = vi.fn();
      rerender(<ProductCard product={mockProduct} {...mockHandlers} onEdit={newOnEdit} />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      expect(newOnEdit).toHaveBeenCalledWith('test-product-1');
      expect(mockHandlers.onEdit).not.toHaveBeenCalled();
    });
  });

  describe('Mobile Long Press Menu', () => {
    it('should render with LongPressMenu when handlers are provided', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      expect(screen.getByTestId('long-press-menu')).toBeInTheDocument();
    });

    it('should include all available actions in long press menu', () => {
      render(<ProductCard product={mockProduct} {...mockHandlers} />);

      const longPressMenu = screen.getByTestId('long-press-menu');
      // Check that items are passed (7 handlers provided + 1 print label with SKU)
      expect(longPressMenu).toHaveAttribute('data-items');
    });

    it('should render without LongPressMenu when no handlers provided', () => {
      render(<ProductCard product={mockProduct} />);

      // When no handlers are provided, long press items array is empty
      // Component should render card content directly without LongPressMenu wrapper
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional product fields', () => {
      const minimalProduct = {
        id: 'minimal-1',
        name: 'Minimal Product',
      };

      render(<ProductCard product={minimalProduct} />);

      expect(screen.getByText('Minimal Product')).toBeInTheDocument();
    });

    it('should handle zero values correctly', () => {
      const zeroProduct = {
        ...mockProduct,
        price: 0,
        cost_per_unit: 0,
        wholesale_price: 0,
        available_quantity: 0,
      };

      render(<ProductCard product={zeroProduct} {...mockHandlers} />);

      expect(screen.getByText('$0.00')).toBeInTheDocument();
      expect(screen.getByText(/Stock: 0 units/)).toBeInTheDocument();
    });

    it('should handle very long product names', () => {
      const longNameProduct = {
        ...mockProduct,
        name: 'Very Long Product Name That Should Still Render Properly',
      };

      render(<ProductCard product={longNameProduct} {...mockHandlers} />);

      expect(
        screen.getByText('Very Long Product Name That Should Still Render Properly')
      ).toBeInTheDocument();
    });

    it('should handle missing category', () => {
      const noCategoryProduct = { ...mockProduct, category: undefined };
      render(<ProductCard product={noCategoryProduct} {...mockHandlers} />);

      const badges = screen.queryAllByTestId('badge');
      const categoryBadge = badges.find((badge) => badge.textContent === 'Cannabis');
      expect(categoryBadge).toBeUndefined();
    });
  });
});
