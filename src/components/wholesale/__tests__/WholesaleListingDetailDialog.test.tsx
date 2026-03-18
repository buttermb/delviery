/**
 * WholesaleListingDetailDialog Tests
 * Verifies the detail dialog renders listing data and handles actions.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WholesaleListingDetailDialog } from '../WholesaleListingDetailDialog';

// Mock formatCurrency
vi.mock('@/lib/utils/formatCurrency', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}));

// Minimal UI mocks so Dialog renders in jsdom
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>{children}</h2>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer" className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" className={className} data-variant={variant}>{children}</span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

// Stub lucide icons
vi.mock('lucide-react', () => ({
  Package: () => <span data-testid="icon-package" />,
  Building2: () => <span data-testid="icon-building" />,
  ShoppingCart: () => <span data-testid="icon-cart" />,
  Lock: () => <span data-testid="icon-lock" />,
  Star: () => <span data-testid="icon-star" />,
  CheckCircle2: () => <span data-testid="icon-check" />,
}));

const baseListing = {
  id: 'listing-1',
  product_name: 'OG Kush',
  description: 'Premium indoor flower',
  product_type: 'flower',
  strain_type: 'indica',
  thc_content: 28.5,
  cbd_content: 0.3,
  base_price: 2400,
  unit_type: 'lb',
  unit_of_measure: 'lb',
  quantity_available: 50,
  images: ['https://img.example.com/og-kush-1.jpg', 'https://img.example.com/og-kush-2.jpg'],
  lab_results: 'https://lab.example.com/results',
  lab_results_encrypted: 'enc-abc123',
  bulk_pricing: [{ min_qty: 10, price: 2200 }],
  available_states: ['CA', 'OR', 'WA'],
  marketplace_profiles: {
    id: 'profile-1',
    business_name: 'Green Valley Farms',
    license_verified: true,
    verified_badge: true,
    average_rating: 4.8,
    total_reviews: 42,
  },
};

describe('WholesaleListingDetailDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={false}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders product name and type when open', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('OG Kush')).toBeInTheDocument();
    expect(screen.getByText('flower')).toBeInTheDocument();
    expect(screen.getByText('indica')).toBeInTheDocument();
  });

  it('renders pricing info', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('$2400.00')).toBeInTheDocument();
    expect(screen.getByText('/ lb')).toBeInTheDocument();
    expect(screen.getByText('50 lb available')).toBeInTheDocument();
  });

  it('renders THC and CBD content', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('28.5%')).toBeInTheDocument();
    expect(screen.getByText('0.3%')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('Premium indoor flower')).toBeInTheDocument();
  });

  it('renders supplier info', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('Green Valley Farms')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('(42)')).toBeInTheDocument();
  });

  it('renders available states', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('CA')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getByText('WA')).toBeInTheDocument();
  });

  it('renders lab tested badge when lab results exist', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('Lab Tested')).toBeInTheDocument();
  });

  it('renders bulk pricing badge when bulk pricing exists', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByText('Bulk pricing available')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={onClose}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onAddToCart when Add to Cart button is clicked', () => {
    const onAddToCart = vi.fn();
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={onAddToCart}
        isAddingToCart={false}
      />,
    );
    fireEvent.click(screen.getByText('Add to Cart'));
    expect(onAddToCart).toHaveBeenCalledOnce();
  });

  it('disables Add to Cart button when isAddingToCart is true', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={true}
      />,
    );
    const addBtn = screen.getByText('Add to Cart');
    expect(addBtn).toBeDisabled();
  });

  it('shows Out of Stock and disables button when quantity is 0', () => {
    const outOfStockListing = { ...baseListing, quantity_available: 0 };
    render(
      <WholesaleListingDetailDialog
        listing={outOfStockListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    // "Out of Stock" appears as both a badge overlay and button text
    const outOfStockElements = screen.getAllByText('Out of Stock');
    expect(outOfStockElements.length).toBeGreaterThanOrEqual(1);
    // The button should be disabled
    const addBtn = outOfStockElements.find((el) => el.tagName === 'BUTTON');
    expect(addBtn).toBeDefined();
    expect(addBtn).toBeDisabled();
  });

  it('renders placeholder when no images', () => {
    const noImageListing = { ...baseListing, images: null };
    render(
      <WholesaleListingDetailDialog
        listing={noImageListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    expect(screen.getByTestId('icon-package')).toBeInTheDocument();
  });

  it('renders thumbnail gallery when multiple images exist', () => {
    render(
      <WholesaleListingDetailDialog
        listing={baseListing}
        open={true}
        onClose={vi.fn()}
        onAddToCart={vi.fn()}
        isAddingToCart={false}
      />,
    );
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
  });
});
