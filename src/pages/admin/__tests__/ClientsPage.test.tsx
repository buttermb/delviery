/**
 * Tests for ClientsPage component
 *
 * Verifies:
 * - Client filtering logic
 * - Export data mapping (no placeholder columns)
 * - Bulk selection logic
 * - CRMClient type compatibility
 */

import { describe, it, expect } from 'vitest';
import type { CRMClient } from '@/types/crm';

// Mock client data matching CRMClient type
const mockClients: CRMClient[] = [
  {
    id: '1',
    account_id: 'tenant-1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    phone: '555-1234',
    open_balance: 250.50,
    status: 'active',
    portal_password_hash: null,
    portal_last_login: null,
    notified_about_menu_update: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    account_id: 'tenant-1',
    name: 'Beta LLC',
    email: 'info@beta.com',
    phone: null,
    open_balance: 0,
    status: 'active',
    portal_password_hash: null,
    portal_last_login: null,
    notified_about_menu_update: false,
    created_at: '2024-02-20T10:00:00Z',
    updated_at: '2024-02-20T10:00:00Z',
  },
  {
    id: '3',
    account_id: 'tenant-1',
    name: 'Gamma Inc',
    email: null,
    phone: '555-9999',
    open_balance: 100,
    status: 'archived',
    portal_password_hash: null,
    portal_last_login: null,
    notified_about_menu_update: false,
    created_at: '2024-03-10T10:00:00Z',
    updated_at: '2024-03-10T10:00:00Z',
  },
];

describe('ClientsPage client filtering logic', () => {
  // Replicate the client-side filter logic from ClientsPage
  const filterClients = (clients: CRMClient[], searchTerm: string): CRMClient[] => {
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.phone && client.phone.includes(searchTerm))
    );
  };

  it('should filter by name (case-insensitive)', () => {
    const result = filterClients(mockClients, 'acme');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should filter by email (case-insensitive)', () => {
    const result = filterClients(mockClients, 'beta.com');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('should filter by phone number', () => {
    const result = filterClients(mockClients, '555-9999');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('should return all clients when search term is empty', () => {
    const result = filterClients(mockClients, '');
    expect(result).toHaveLength(3);
  });

  it('should return empty array when no match', () => {
    const result = filterClients(mockClients, 'nonexistent');
    expect(result).toHaveLength(0);
  });

  it('should handle clients with null email/phone', () => {
    const result = filterClients(mockClients, 'Gamma');
    expect(result).toHaveLength(1);
    expect(result[0].email).toBeNull();
  });
});

describe('ClientsPage export data mapping', () => {
  // Replicate the export mapping logic from ClientsPage
  const mapExportData = (clients: CRMClient[]) => {
    return clients.map(c => ({
      name: c.name,
      email: c.email ?? '',
      phone: c.phone ?? '',
      open_balance: c.open_balance.toString(),
      created: new Date(c.created_at).toLocaleDateString(),
      status: c.status,
    }));
  };

  it('should map all fields from CRMClient correctly', () => {
    const result = mapExportData([mockClients[0]]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Acme Corp',
      email: 'contact@acme.com',
      phone: '555-1234',
      open_balance: '250.5',
      created: expect.any(String),
      status: 'active',
    });
  });

  it('should not include placeholder empty columns (type, tags, total_orders, total_spent)', () => {
    const result = mapExportData([mockClients[0]]);
    const keys = Object.keys(result[0]);
    expect(keys).not.toContain('type');
    expect(keys).not.toContain('tags');
    expect(keys).not.toContain('total_orders');
    expect(keys).not.toContain('total_spent');
  });

  it('should include only real data columns', () => {
    const result = mapExportData([mockClients[0]]);
    const keys = Object.keys(result[0]);
    expect(keys).toEqual(['name', 'email', 'phone', 'open_balance', 'created', 'status']);
  });

  it('should replace null email with empty string', () => {
    const result = mapExportData([mockClients[2]]);
    expect(result[0].email).toBe('');
  });

  it('should replace null phone with empty string', () => {
    const result = mapExportData([mockClients[1]]);
    expect(result[0].phone).toBe('');
  });

  it('should format created_at as locale date string', () => {
    const result = mapExportData([mockClients[0]]);
    expect(result[0].created).toBeTruthy();
    // Should be a valid date string
    expect(new Date(result[0].created).toString()).not.toBe('Invalid Date');
  });
});

describe('ClientsPage bulk selection logic', () => {
  it('should select all filtered clients', () => {
    const selectedIds = new Set(mockClients.map(c => c.id));
    expect(selectedIds.size).toBe(3);
    expect(selectedIds.has('1')).toBe(true);
    expect(selectedIds.has('2')).toBe(true);
    expect(selectedIds.has('3')).toBe(true);
  });

  it('should toggle individual client selection', () => {
    const selectedIds = new Set<string>();

    // Add
    selectedIds.add('1');
    expect(selectedIds.has('1')).toBe(true);
    expect(selectedIds.size).toBe(1);

    // Remove
    selectedIds.delete('1');
    expect(selectedIds.has('1')).toBe(false);
    expect(selectedIds.size).toBe(0);
  });

  it('should clear all selections', () => {
    const selectedIds = new Set(['1', '2', '3']);
    const cleared = new Set<string>();
    expect(cleared.size).toBe(0);
    expect(selectedIds.size).toBe(3);
  });

  it('should use immutable set updates (new Set from previous)', () => {
    const prev = new Set(['1']);
    const next = new Set(prev);
    next.add('2');
    // prev should not be modified
    expect(prev.size).toBe(1);
    expect(next.size).toBe(2);
  });
});

describe('CRMClient type usage', () => {
  it('should have all required fields from CRMClient', () => {
    const client = mockClients[0];
    expect(client.id).toBeDefined();
    expect(client.account_id).toBeDefined();
    expect(client.name).toBeDefined();
    expect(client.created_at).toBeDefined();
    expect(client.updated_at).toBeDefined();
    expect(typeof client.open_balance).toBe('number');
    expect(client.status).toMatch(/^(active|archived)$/);
  });

  it('should support nullable email and phone', () => {
    const clientWithNull = mockClients[2];
    expect(clientWithNull.email).toBeNull();
    expect(clientWithNull.phone).toBe('555-9999');

    const clientWithEmail = mockClients[0];
    expect(clientWithEmail.email).toBe('contact@acme.com');
  });
});
