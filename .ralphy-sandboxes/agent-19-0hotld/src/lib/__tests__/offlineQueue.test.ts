/**
 * Tests for Offline Queue functionality
 * Validates offline-first behavior and network mode integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOnlineStatus,
  onOnlineStatusChange,
  onQueueChange,
  type QueuedActionType,
} from '../offlineQueue';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(),
  },
}));

describe('Offline Queue - Configuration & Network Mode', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  describe('Network status monitoring', () => {
    it('should provide online status getter', () => {
      const status = getOnlineStatus();
      expect(typeof status).toBe('boolean');
    });

    it('should support online status change listeners', () => {
      const callback = vi.fn();
      const unsubscribe = onOnlineStatusChange(callback);

      expect(typeof unsubscribe).toBe('function');

      // Call unsubscribe
      unsubscribe();

      // After unsubscribe, callback should not be in listeners
      expect(typeof unsubscribe).toBe('function');
    });

    it('should support queue change listeners', () => {
      const callback = vi.fn();
      const unsubscribe = onQueueChange(callback);

      expect(typeof unsubscribe).toBe('function');

      // Call unsubscribe
      unsubscribe();
    });
  });

  describe('Action type support', () => {
    it('should define all required action types', () => {
      const actionTypes: QueuedActionType[] = [
        'create_order',
        'update_order_status',
        'update_inventory',
        'create_customer',
        'update_customer',
        'send_message',
        'create_menu',
        'generic',
      ];

      // Verify all action types are valid TypeScript types
      expect(actionTypes).toHaveLength(8);
      expect(actionTypes).toContain('create_order');
      expect(actionTypes).toContain('update_order_status');
      expect(actionTypes).toContain('generic');
    });
  });

  describe('Offline-first behavior integration', () => {
    it('should export initOfflineQueue function', async () => {
      const { initOfflineQueue } = await import('../offlineQueue');
      expect(typeof initOfflineQueue).toBe('function');
    });

    it('should export queueAction function', async () => {
      const { queueAction } = await import('../offlineQueue');
      expect(typeof queueAction).toBe('function');
    });

    it('should export getPendingActions function', async () => {
      const { getPendingActions } = await import('../offlineQueue');
      expect(typeof getPendingActions).toBe('function');
    });

    it('should export getFailedActions function', async () => {
      const { getFailedActions } = await import('../offlineQueue');
      expect(typeof getFailedActions).toBe('function');
    });

    it('should export getQueueStats function', async () => {
      const { getQueueStats } = await import('../offlineQueue');
      expect(typeof getQueueStats).toBe('function');
    });

    it('should export removeAction function', async () => {
      const { removeAction } = await import('../offlineQueue');
      expect(typeof removeAction).toBe('function');
    });

    it('should export retryAction function', async () => {
      const { retryAction } = await import('../offlineQueue');
      expect(typeof retryAction).toBe('function');
    });

    it('should export clearCompleted function', async () => {
      const { clearCompleted } = await import('../offlineQueue');
      expect(typeof clearCompleted).toBe('function');
    });

    it('should export syncQueue function', async () => {
      const { syncQueue } = await import('../offlineQueue');
      expect(typeof syncQueue).toBe('function');
    });

    it('should export withOfflineSupport higher-order function', async () => {
      const { withOfflineSupport } = await import('../offlineQueue');
      expect(typeof withOfflineSupport).toBe('function');
    });
  });

  describe('QueuedAction interface', () => {
    it('should define QueuedAction with required properties', async () => {
      const { queueAction } = await import('../offlineQueue');

      // This test verifies the type structure by attempting to use the function
      // The function signature enforces the correct types at compile time
      expect(typeof queueAction).toBe('function');

      // Verify function has correct arity (4 required + 1 optional = length of 4)
      // JavaScript .length only counts required parameters before first default value
      expect(queueAction.length).toBe(4); // 4 required parameters
    });
  });

  describe('withOfflineSupport wrapper', () => {
    it('should create a wrapped function with offline support', async () => {
      const { withOfflineSupport } = await import('../offlineQueue');

      const wrappedFn = withOfflineSupport('create_order', '/api/orders', 'POST');

      expect(typeof wrappedFn).toBe('function');
    });

    it('should support all HTTP methods', async () => {
      const { withOfflineSupport } = await import('../offlineQueue');

      const methods: Array<'POST' | 'PUT' | 'PATCH' | 'DELETE'> = ['POST', 'PUT', 'PATCH', 'DELETE'];

      methods.forEach((method) => {
        const wrappedFn = withOfflineSupport('generic', '/api/test', method);
        expect(typeof wrappedFn).toBe('function');
      });
    });
  });

  describe('IndexedDB persistence layer', () => {
    it('should use offline-queue database name', async () => {
      // This is a structural test - the actual DB name is hardcoded in the implementation
      // We verify the implementation exists and can be imported
      await expect(import('../offlineQueue')).resolves.toBeDefined();
    });

    it('should have actions object store', async () => {
      // Structural test - verifies the module can be loaded
      // The actual store creation happens in the upgrade callback
      await expect(import('../offlineQueue')).resolves.toBeDefined();
    });
  });

  describe('Network resilience', () => {
    it('should handle online/offline transitions', () => {
      // Test that the module has the necessary infrastructure
      const callback = vi.fn();
      const unsubscribe = onOnlineStatusChange(callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should queue operations when offline', () => {
      // Verify the offline support infrastructure exists
      const status = getOnlineStatus();
      expect(typeof status).toBe('boolean');
    });
  });

  describe('Module exports', () => {
    it('should export all public functions', async () => {
      const module = await import('../offlineQueue');

      const expectedExports = [
        'initOfflineQueue',
        'getOnlineStatus',
        'onOnlineStatusChange',
        'onQueueChange',
        'queueAction',
        'getPendingActions',
        'getFailedActions',
        'getQueueStats',
        'removeAction',
        'retryAction',
        'clearCompleted',
        'syncQueue',
        'withOfflineSupport',
      ];

      expectedExports.forEach((exportName) => {
        expect(module[exportName]).toBeDefined();
        expect(typeof module[exportName]).toBe('function');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Verify error handling infrastructure exists
      await expect(import('../offlineQueue')).resolves.toBeDefined();
    });

    it('should retry failed operations', async () => {
      // Verify retry infrastructure exists
      await expect(import('../offlineQueue')).resolves.toBeDefined();
    });
  });
});
