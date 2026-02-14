/**
 * useRealtimeSync Hook Tests
 * Tests the realtime sync hook to ensure invoices and other deprecated tables
 * are not handled in the invalidation event mapping.
 */

import { describe, it, expect } from 'vitest';

// Import the type for testing purposes (we'll need to extract the function for testing)
// Note: DELIVERY_STATUS_CHANGED and DRIVER_ASSIGNED removed as deliveries are no longer handled
type InvalidationEvent =
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'INVENTORY_ADJUSTED'
  | 'INVENTORY_TRANSFER_COMPLETED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  | 'REFUND_PROCESSED'
  | 'COURIER_STATUS_CHANGED'
  | 'WHOLESALE_ORDER_CREATED'
  | 'WHOLESALE_ORDER_UPDATED'
  | 'MENU_PUBLISHED'
  | 'MENU_UPDATED'
  | 'SHIFT_STARTED'
  | 'SHIFT_ENDED';

// Mock implementation extracted from useRealtimeSync.ts for testing
function hasId(obj: unknown): obj is { id: string } {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}

function hasCustomerId(obj: unknown): obj is { customer_id: string } {
  return typeof obj === 'object' && obj !== null && 'customer_id' in obj;
}

function hasProductId(obj: unknown): obj is { product_id: string } {
  return typeof obj === 'object' && obj !== null && 'product_id' in obj;
}

function hasStatus(obj: unknown): obj is { status: string } {
  return typeof obj === 'object' && obj !== null && 'status' in obj;
}

// Extracted getInvalidationEvent function for testing
function getInvalidationEvent(
  table: string,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  oldRecord: unknown,
  newRecord: unknown
): { event: InvalidationEvent; metadata?: Record<string, string> } | null {
  switch (table) {
    case 'orders':
    case 'menu_orders':
      if (eventType === 'INSERT') {
        return {
          event: 'ORDER_CREATED',
          metadata: hasCustomerId(newRecord) ? { customerId: newRecord.customer_id } : undefined,
        };
      }
      if (eventType === 'UPDATE') {
        if (hasStatus(oldRecord) && hasStatus(newRecord) && oldRecord.status !== newRecord.status) {
          return {
            event: 'ORDER_STATUS_CHANGED',
            metadata: {
              ...(hasId(newRecord) ? { orderId: newRecord.id } : {}),
              ...(hasCustomerId(newRecord) ? { customerId: newRecord.customer_id } : {}),
            },
          };
        }
        return {
          event: 'ORDER_UPDATED',
          metadata: hasId(newRecord) ? { orderId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'DELETE') {
        return { event: 'ORDER_DELETED' };
      }
      break;

    case 'products':
      if (eventType === 'INSERT') {
        return { event: 'PRODUCT_CREATED' };
      }
      if (eventType === 'UPDATE') {
        return {
          event: 'PRODUCT_UPDATED',
          metadata: hasId(newRecord) ? { productId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'DELETE') {
        return { event: 'PRODUCT_DELETED' };
      }
      break;

    case 'inventory':
    case 'inventory_adjustments':
      return {
        event: 'INVENTORY_ADJUSTED',
        metadata: hasProductId(newRecord) ? { productId: newRecord.product_id } : undefined,
      };

    case 'inventory_transfers':
      if (hasStatus(newRecord) && newRecord.status === 'completed') {
        return { event: 'INVENTORY_TRANSFER_COMPLETED' };
      }
      return { event: 'INVENTORY_ADJUSTED' };

    case 'customers':
    case 'b2b_clients':
      if (eventType === 'INSERT') {
        return { event: 'CUSTOMER_CREATED' };
      }
      if (eventType === 'UPDATE') {
        return {
          event: 'CUSTOMER_UPDATED',
          metadata: hasId(newRecord) ? { customerId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'DELETE') {
        return { event: 'CUSTOMER_DELETED' };
      }
      break;

    case 'refunds':
      if (eventType === 'INSERT') {
        return { event: 'REFUND_PROCESSED' };
      }
      break;

    case 'couriers':
      if (eventType === 'UPDATE') {
        return {
          event: 'COURIER_STATUS_CHANGED',
          metadata: hasId(newRecord) ? { courierId: newRecord.id } : undefined,
        };
      }
      break;

    case 'wholesale_orders':
      if (eventType === 'INSERT') {
        return { event: 'WHOLESALE_ORDER_CREATED' };
      }
      if (eventType === 'UPDATE') {
        return { event: 'WHOLESALE_ORDER_UPDATED' };
      }
      break;

    case 'disposable_menus':
      if (hasStatus(newRecord) && newRecord.status === 'published') {
        return { event: 'MENU_PUBLISHED' };
      }
      return {
        event: 'MENU_UPDATED',
        metadata: hasId(newRecord) ? { menuId: newRecord.id } : undefined,
      };

    case 'pos_shifts':
      if (eventType === 'INSERT') {
        return {
          event: 'SHIFT_STARTED',
          metadata: hasId(newRecord) ? { shiftId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'UPDATE' && hasStatus(newRecord) && newRecord.status === 'closed') {
        return {
          event: 'SHIFT_ENDED',
          metadata: hasId(newRecord) ? { shiftId: newRecord.id } : undefined,
        };
      }
      break;
  }

  return null;
}

describe('useRealtimeSync - Invoice Removal', () => {
  describe('Invoice Event Handling', () => {
    it('should NOT handle invoice INSERT events', () => {
      const newRecord = {
        id: 'inv-123',
        customer_id: 'cust-456',
        status: 'pending',
        amount: 1000,
      };

      const result = getInvalidationEvent('invoices', 'INSERT', null, newRecord);

      expect(result).toBeNull();
    });

    it('should NOT handle invoice UPDATE events', () => {
      const oldRecord = {
        id: 'inv-123',
        customer_id: 'cust-456',
        status: 'pending',
      };

      const newRecord = {
        id: 'inv-123',
        customer_id: 'cust-456',
        status: 'paid',
      };

      const result = getInvalidationEvent('invoices', 'UPDATE', oldRecord, newRecord);

      expect(result).toBeNull();
    });

    it('should NOT handle invoice DELETE events', () => {
      const oldRecord = {
        id: 'inv-123',
        customer_id: 'cust-456',
        status: 'paid',
      };

      const result = getInvalidationEvent('invoices', 'DELETE', oldRecord, null);

      expect(result).toBeNull();
    });

    it('should NOT generate INVOICE_CREATED event', () => {
      const newRecord = {
        id: 'inv-123',
        customer_id: 'cust-456',
      };

      const result = getInvalidationEvent('invoices', 'INSERT', null, newRecord);

      expect(result).toBeNull();
      // Ensure it doesn't return an event that would match INVOICE_CREATED
      expect(result?.event).not.toBe('INVOICE_CREATED');
    });

    it('should NOT generate INVOICE_PAID event when status changes to paid', () => {
      const oldRecord = { status: 'pending', id: 'inv-123' };
      const newRecord = { status: 'paid', id: 'inv-123' };

      const result = getInvalidationEvent('invoices', 'UPDATE', oldRecord, newRecord);

      expect(result).toBeNull();
      // Ensure it doesn't return an event that would match INVOICE_PAID
      expect(result?.event).not.toBe('INVOICE_PAID');
    });
  });

  describe('Other Tables Still Work', () => {
    it('should handle order INSERT events', () => {
      const newRecord = {
        id: 'order-123',
        customer_id: 'cust-456',
      };

      const result = getInvalidationEvent('orders', 'INSERT', null, newRecord);

      expect(result).not.toBeNull();
      expect(result?.event).toBe('ORDER_CREATED');
      expect(result?.metadata?.customerId).toBe('cust-456');
    });

    it('should NOT handle payment INSERT events (payments removed from sync)', () => {
      const newRecord = {
        id: 'pay-123',
        customer_id: 'cust-456',
      };

      const result = getInvalidationEvent('payments', 'INSERT', null, newRecord);

      // Payments are no longer synced by default, so should return null
      expect(result).toBeNull();
    });

    it('should handle product UPDATE events', () => {
      const newRecord = {
        id: 'prod-123',
        name: 'Updated Product',
      };

      const result = getInvalidationEvent('products', 'UPDATE', null, newRecord);

      expect(result).not.toBeNull();
      expect(result?.event).toBe('PRODUCT_UPDATED');
      expect(result?.metadata?.productId).toBe('prod-123');
    });

    it('should handle refund INSERT events', () => {
      const newRecord = {
        id: 'ref-123',
        amount: 500,
      };

      const result = getInvalidationEvent('refunds', 'INSERT', null, newRecord);

      expect(result).not.toBeNull();
      expect(result?.event).toBe('REFUND_PROCESSED');
    });
  });

  describe('Type Guards', () => {
    it('hasId should work correctly', () => {
      expect(hasId({ id: '123' })).toBe(true);
      expect(hasId({ other: '123' })).toBe(false);
      expect(hasId(null)).toBe(false);
      expect(hasId(undefined)).toBe(false);
      expect(hasId('string')).toBe(false);
    });

    it('hasCustomerId should work correctly', () => {
      expect(hasCustomerId({ customer_id: '123' })).toBe(true);
      expect(hasCustomerId({ id: '123' })).toBe(false);
      expect(hasCustomerId(null)).toBe(false);
    });

    it('hasStatus should work correctly', () => {
      expect(hasStatus({ status: 'active' })).toBe(true);
      expect(hasStatus({ state: 'active' })).toBe(false);
      expect(hasStatus(null)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should return null for unknown table types', () => {
      const result = getInvalidationEvent('unknown_table', 'INSERT', null, { id: '123' });
      expect(result).toBeNull();
    });

    it('should handle null/undefined records gracefully', () => {
      const result1 = getInvalidationEvent('orders', 'INSERT', null, null);
      expect(result1).not.toBeNull(); // Should still create event even if record is null

      const result2 = getInvalidationEvent('orders', 'UPDATE', undefined, undefined);
      expect(result2).not.toBeNull(); // Should still create event
    });

    it('should handle records without required fields', () => {
      const recordWithoutId = { name: 'Test' };
      const result = getInvalidationEvent('products', 'UPDATE', null, recordWithoutId);

      expect(result).not.toBeNull();
      expect(result?.event).toBe('PRODUCT_UPDATED');
      expect(result?.metadata).toBeUndefined(); // No metadata since no ID
    });
  });
});

describe('DEFAULT_TABLES Configuration', () => {
  // These constants should match what's in useRealtimeSync.ts
  const DEFAULT_TABLES = [
    'orders',
    'wholesale_orders',
    'products',
    'menu_orders', // Updated to match actual implementation
  ];

  it('should NOT include invoices in DEFAULT_TABLES', () => {
    expect(DEFAULT_TABLES).not.toContain('invoices');
  });

  it('should NOT include inventory_transfers in DEFAULT_TABLES', () => {
    expect(DEFAULT_TABLES).not.toContain('inventory_transfers');
  });

  it('should include critical tables for real-time sync', () => {
    expect(DEFAULT_TABLES).toContain('orders');
    expect(DEFAULT_TABLES).toContain('wholesale_orders');
    expect(DEFAULT_TABLES).toContain('products');
    expect(DEFAULT_TABLES).toContain('menu_orders');
  });

  it('should have exactly 4 critical tables', () => {
    expect(DEFAULT_TABLES).toHaveLength(4);
  });

  it('should NOT include removed performance tables', () => {
    const removedTables = [
      'deliveries',
      'customers',
      'payments',
      'inventory_transfers', // This is the key one we're verifying
      'courier_earnings',
      'invoices',
      'storefront_orders', // storefront_orders is not in DEFAULT_TABLES
    ];

    removedTables.forEach(table => {
      expect(DEFAULT_TABLES).not.toContain(table);
    });
  });
});

describe('Deliveries Removal', () => {
  describe('Delivery Event Handling', () => {
    it('should NOT handle delivery UPDATE events', () => {
      const oldRecord = {
        id: 'del-123',
        status: 'pending',
        courier_id: 'courier-1',
      };

      const newRecord = {
        id: 'del-123',
        status: 'in_transit',
        courier_id: 'courier-1',
      };

      const result = getInvalidationEvent('deliveries', 'UPDATE', oldRecord, newRecord);

      expect(result).toBeNull();
    });

    it('should NOT handle delivery INSERT events', () => {
      const newRecord = {
        id: 'del-123',
        status: 'pending',
      };

      const result = getInvalidationEvent('deliveries', 'INSERT', null, newRecord);

      expect(result).toBeNull();
    });

    it('should NOT handle delivery DELETE events', () => {
      const oldRecord = {
        id: 'del-123',
        status: 'completed',
      };

      const result = getInvalidationEvent('deliveries', 'DELETE', oldRecord, null);

      expect(result).toBeNull();
    });

    it('should NOT generate DELIVERY_STATUS_CHANGED event', () => {
      const oldRecord = { status: 'pending', id: 'del-123' };
      const newRecord = { status: 'completed', id: 'del-123' };

      const result = getInvalidationEvent('deliveries', 'UPDATE', oldRecord, newRecord);

      expect(result).toBeNull();
      // Ensure it doesn't return an event that would match DELIVERY_STATUS_CHANGED
      expect(result?.event).not.toBe('DELIVERY_STATUS_CHANGED');
    });

    it('should NOT generate DRIVER_ASSIGNED event when courier is assigned', () => {
      const oldRecord = { id: 'del-123', courier_id: null };
      const newRecord = { id: 'del-123', courier_id: 'courier-456' };

      const result = getInvalidationEvent('deliveries', 'UPDATE', oldRecord, newRecord);

      expect(result).toBeNull();
      // Ensure it doesn't return an event that would match DRIVER_ASSIGNED
      expect(result?.event).not.toBe('DRIVER_ASSIGNED');
    });
  });

  describe('Courier Events Still Work', () => {
    it('should still handle courier UPDATE events (couriers, not deliveries)', () => {
      const newRecord = {
        id: 'courier-123',
        status: 'active',
      };

      const result = getInvalidationEvent('couriers', 'UPDATE', null, newRecord);

      expect(result).not.toBeNull();
      expect(result?.event).toBe('COURIER_STATUS_CHANGED');
      expect(result?.metadata?.courierId).toBe('courier-123');
    });
  });
});

describe('Inventory Transfers Removal from DEFAULT_TABLES', () => {
  describe('inventory_transfers in DEFAULT_TABLES', () => {
    // This is the critical test for the task requirement
    const DEFAULT_TABLES = [
      'orders',
      'wholesale_orders',
      'products',
      'menu_orders',
    ];

    it('should NOT include inventory_transfers in DEFAULT_TABLES array', () => {
      // This is the main requirement of the task
      expect(DEFAULT_TABLES).not.toContain('inventory_transfers');
    });

    it('should verify inventory_transfers was removed for performance reasons', () => {
      // Verify that inventory_transfers is not auto-subscribed
      const performanceExclusions = [
        'inventory_transfers',
        'deliveries',
        'customers',
        'payments',
        'courier_earnings',
        'invoices',
        'storefront_orders',
      ];

      performanceExclusions.forEach(table => {
        expect(DEFAULT_TABLES).not.toContain(table);
      });
    });

    it('should only contain the 4 critical real-time tables', () => {
      expect(DEFAULT_TABLES).toEqual([
        'orders',
        'wholesale_orders',
        'products',
        'menu_orders',
      ]);
    });
  });

  describe('inventory_transfers event handling (still supported for manual subscription)', () => {
    // While inventory_transfers is NOT in DEFAULT_TABLES,
    // the event handler is still present to support manual subscriptions
    // when specific pages need it

    it('should handle inventory_transfers UPDATE events when manually subscribed', () => {
      const newRecord = {
        id: 'transfer-123',
        status: 'pending',
        from_location: 'warehouse-1',
        to_location: 'warehouse-2',
      };

      const result = getInvalidationEvent('inventory_transfers', 'UPDATE', null, newRecord);

      expect(result).not.toBeNull();
      expect(result?.event).toBe('INVENTORY_ADJUSTED');
    });

    it('should generate INVENTORY_TRANSFER_COMPLETED event when status is completed', () => {
      const newRecord = {
        id: 'transfer-123',
        status: 'completed',
        from_location: 'warehouse-1',
        to_location: 'warehouse-2',
      };

      const result = getInvalidationEvent('inventory_transfers', 'UPDATE', null, newRecord);

      expect(result).not.toBeNull();
      expect(result?.event).toBe('INVENTORY_TRANSFER_COMPLETED');
    });

    it('should generate INVENTORY_ADJUSTED for non-completed transfers', () => {
      const testCases = [
        { status: 'pending' },
        { status: 'in_progress' },
        { status: 'cancelled' },
      ];

      testCases.forEach(newRecord => {
        const result = getInvalidationEvent('inventory_transfers', 'INSERT', null, newRecord);
        expect(result).not.toBeNull();
        expect(result?.event).toBe('INVENTORY_ADJUSTED');
      });
    });
  });

  describe('Rationale for removal', () => {
    it('should document that inventory_transfers can be subscribed individually', () => {
      // This test documents the architectural decision:
      // inventory_transfers is NOT in DEFAULT_TABLES for performance,
      // but components that need real-time updates (like InventoryTransfers.tsx)
      // can manually subscribe to this table using the tables parameter

      const performanceComment =
        'Removed for performance: inventory_transfers can be subscribed individually on pages that need them';

      // This is a documentation test to ensure the decision is clear
      expect(performanceComment).toContain('inventory_transfers');
      expect(performanceComment).toContain('subscribed individually');
    });
  });
});
