/**
 * Tests for SupplierManagementPage
 *
 * Verifies supplier management logic:
 * - Search sanitization and filtering
 * - Status badge mapping
 * - Supplier data filtering by status
 */

import { describe, it, expect } from 'vitest';
import { sanitizeSearchInput } from '@/lib/sanitizeSearch';

// Replicate the client-side search filter logic from SupplierManagementPage
interface MockSupplier {
  id: string;
  supplier_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  payment_terms: string | null;
}

function filterSuppliers(suppliers: MockSupplier[], searchTerm: string): MockSupplier[] {
  const sanitizedSearch = sanitizeSearchInput(searchTerm).toLowerCase();

  return suppliers.filter((supplier) => {
    if (!sanitizedSearch) return true;

    return (
      supplier.supplier_name?.toLowerCase().includes(sanitizedSearch) ||
      supplier.contact_person?.toLowerCase().includes(sanitizedSearch) ||
      supplier.email?.toLowerCase().includes(sanitizedSearch) ||
      supplier.phone?.toLowerCase().includes(sanitizedSearch)
    );
  });
}

function getStatusDisplay(status: string | null): { label: string; variant: 'default' | 'secondary' } {
  return status === 'active'
    ? { label: 'Active', variant: 'default' }
    : { label: 'Inactive', variant: 'secondary' };
}

function filterByStatus(suppliers: MockSupplier[], filter: 'all' | 'active' | 'inactive'): MockSupplier[] {
  if (filter === 'all') return suppliers;
  return suppliers.filter((s) => s.status === filter);
}

const mockSuppliers: MockSupplier[] = [
  { id: '1', supplier_name: 'Green Valley Farms', contact_person: 'John Doe', email: 'john@greenvalley.com', phone: '555-1234', status: 'active', payment_terms: 'Net 30' },
  { id: '2', supplier_name: 'Mountain Supply Co', contact_person: 'Jane Smith', email: 'jane@mountain.com', phone: '555-5678', status: 'inactive', payment_terms: 'COD' },
  { id: '3', supplier_name: 'Pacific Distributors', contact_person: 'Bob Wilson', email: 'bob@pacific.com', phone: '555-9012', status: 'active', payment_terms: 'Net 60' },
];

describe('SupplierManagementPage search filtering', () => {
  it('should return all suppliers when search is empty', () => {
    expect(filterSuppliers(mockSuppliers, '')).toHaveLength(3);
  });

  it('should filter by supplier name', () => {
    const result = filterSuppliers(mockSuppliers, 'Green Valley');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by contact person', () => {
    const result = filterSuppliers(mockSuppliers, 'Jane');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should filter by email', () => {
    const result = filterSuppliers(mockSuppliers, 'bob@pacific');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('should filter by phone', () => {
    const result = filterSuppliers(mockSuppliers, '555-5678');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should be case-insensitive', () => {
    const result = filterSuppliers(mockSuppliers, 'GREEN VALLEY');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should sanitize search input with special characters', () => {
    const result = filterSuppliers(mockSuppliers, '<script>alert("xss")</script>');
    expect(result).toHaveLength(0);
  });

  it('should handle whitespace-only search', () => {
    const result = filterSuppliers(mockSuppliers, '   ');
    expect(result).toHaveLength(3);
  });

  it('should return empty for non-matching search', () => {
    const result = filterSuppliers(mockSuppliers, 'nonexistent');
    expect(result).toHaveLength(0);
  });
});

describe('SupplierManagementPage status display', () => {
  it('should return Active for active status', () => {
    const display = getStatusDisplay('active');
    expect(display.label).toBe('Active');
    expect(display.variant).toBe('default');
  });

  it('should return Inactive for inactive status', () => {
    const display = getStatusDisplay('inactive');
    expect(display.label).toBe('Inactive');
    expect(display.variant).toBe('secondary');
  });

  it('should return Inactive for null status', () => {
    const display = getStatusDisplay(null);
    expect(display.label).toBe('Inactive');
    expect(display.variant).toBe('secondary');
  });
});

describe('SupplierManagementPage status filter', () => {
  it('should return all suppliers when filter is "all"', () => {
    const result = filterByStatus(mockSuppliers, 'all');
    expect(result).toHaveLength(3);
  });

  it('should return only active suppliers when filter is "active"', () => {
    const result = filterByStatus(mockSuppliers, 'active');
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.status === 'active')).toBe(true);
  });

  it('should return only inactive suppliers when filter is "inactive"', () => {
    const result = filterByStatus(mockSuppliers, 'inactive');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });
});
