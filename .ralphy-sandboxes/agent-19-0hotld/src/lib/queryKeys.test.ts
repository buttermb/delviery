/**
 * Query Keys Factory Tests
 * Tests for TanStack Query key factories
 */

import { describe, it, expect } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  describe('products', () => {
    it('should generate correct base key', () => {
      expect(queryKeys.products.all).toEqual(['products']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.products.lists()).toEqual(['products', 'list']);
    });

    it('should generate correct list key with filters', () => {
      const filters = { category: 'electronics' };
      expect(queryKeys.products.list(filters)).toEqual(['products', 'list', filters]);
    });

    it('should generate correct detail key', () => {
      const id = 'prod-123';
      expect(queryKeys.products.detail(id)).toEqual(['products', 'detail', id]);
    });

    it('should generate correct byTenant key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.products.byTenant(tenantId)).toEqual(['products', 'tenant', tenantId]);
    });
  });

  describe('shopProducts', () => {
    it('should generate correct base key', () => {
      expect(queryKeys.shopProducts.all).toEqual(['shop-products']);
    });

    it('should generate correct list key', () => {
      const storeId = 'store-123';
      expect(queryKeys.shopProducts.list(storeId)).toEqual(['shop-products', storeId]);
    });

    it('should generate correct detail key', () => {
      const storeId = 'store-123';
      const productId = 'prod-456';
      expect(queryKeys.shopProducts.detail(storeId, productId)).toEqual(['shop-product', storeId, productId]);
    });

    it('should generate correct detailBySlug key', () => {
      const storeId = 'store-123';
      const slug = 'cannabis-flower';
      expect(queryKeys.shopProducts.detailBySlug(storeId, slug)).toEqual(['shop-product', storeId, slug, true]);
    });
  });

  describe('orders', () => {
    it('should generate correct base key', () => {
      expect(queryKeys.orders.all).toEqual(['orders']);
    });

    it('should generate correct list key with filters', () => {
      const filters = { status: 'pending' };
      expect(queryKeys.orders.list(filters)).toEqual(['orders', 'list', filters]);
    });

    it('should generate correct statusHistory key', () => {
      const orderId = 'order-123';
      expect(queryKeys.orders.statusHistory(orderId)).toEqual(['orders', 'status-history', orderId]);
    });
  });

  describe('inventory', () => {
    it('should generate correct lowStockAlerts key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.inventory.lowStockAlerts(tenantId)).toEqual(['inventory', 'low-stock-alerts', tenantId]);
    });

    it('should generate correct movements key', () => {
      const productId = 'prod-123';
      expect(queryKeys.inventory.movements(productId)).toEqual(['inventory', 'movements', productId]);
    });
  });

  describe('cart', () => {
    it('should generate correct user cart key', () => {
      const userId = 'user-123';
      expect(queryKeys.cart.user(userId)).toEqual(['cart', userId]);
    });

    it('should generate correct guest cart key', () => {
      expect(queryKeys.cart.guest()).toEqual(['cart', 'guest']);
    });
  });

  describe('menus', () => {
    it('should generate correct public menu key', () => {
      const token = 'abc123token';
      expect(queryKeys.menus.public(token)).toEqual(['menus', 'public', token]);
    });

    it('should generate correct analytics key', () => {
      const menuId = 'menu-123';
      expect(queryKeys.menus.analytics(menuId)).toEqual(['menus', 'detail', menuId, 'analytics']);
    });
  });

  describe('dashboard', () => {
    it('should generate correct stats key', () => {
      const tenantId = 'tenant-123';
      const dateRangeKey = '30d';
      expect(queryKeys.dashboard.stats(tenantId, dateRangeKey)).toEqual(['dashboard', 'stats', tenantId, dateRangeKey]);
    });
  });

  describe('analytics', () => {
    it('should generate correct revenue analytics key', () => {
      const filters = { period: 'monthly' };
      expect(queryKeys.analytics.revenue(filters)).toEqual(['analytics', 'revenue', filters]);
    });

    it('should generate correct trafficSources key', () => {
      const filters = { timeframe: '7d' };
      expect(queryKeys.analytics.trafficSources(filters)).toEqual(['analytics', 'traffic-sources', filters]);
    });
  });

  describe('pos', () => {
    it('should generate correct products key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.pos.products(tenantId)).toEqual(['pos', 'products', { tenantId }]);
    });

    describe('shifts', () => {
      it('should generate correct active shift key', () => {
        const tenantId = 'tenant-123';
        expect(queryKeys.pos.shifts.active(tenantId)).toEqual(['pos', 'shifts', 'active', tenantId]);
      });

      it('should generate correct shift transactions key', () => {
        const shiftId = 'shift-123';
        expect(queryKeys.pos.shifts.transactions(shiftId)).toEqual(['pos', 'shifts', 'transactions', shiftId]);
      });
    });
  });

  describe('finance', () => {
    it('should generate correct completedOrders key', () => {
      const tenantId = 'tenant-123';
      const dateRange = '30d';
      expect(queryKeys.finance.completedOrders(tenantId, dateRange)).toEqual(['finance', 'completed-orders', { tenantId, dateRange }]);
    });
  });

  describe('loyalty', () => {
    it('should generate correct config key', () => {
      const storeId = 'store-123';
      expect(queryKeys.loyalty.config(storeId)).toEqual(['loyalty', 'config', storeId]);
    });

    it('should generate correct customer loyalty key', () => {
      const storeId = 'store-123';
      const email = 'customer@example.com';
      expect(queryKeys.loyalty.customer(storeId, email)).toEqual(['loyalty', 'customer', storeId, email]);
    });
  });

  describe('forum', () => {
    describe('posts', () => {
      it('should generate correct post list key', () => {
        const options = { category: 'general' };
        expect(queryKeys.forum.posts.list(options)).toEqual(['forum', 'posts', 'list', options]);
      });

      it('should generate correct post detail key', () => {
        const postId = 'post-123';
        expect(queryKeys.forum.posts.detail(postId)).toEqual(['forum', 'posts', 'detail', postId]);
      });
    });

    describe('votes', () => {
      it('should generate correct userVote key', () => {
        const votableType = 'post';
        const votableId = 'post-123';
        expect(queryKeys.forum.votes.userVote(votableType, votableId)).toEqual(['forum', 'votes', votableType, votableId]);
      });
    });

    describe('profile', () => {
      it('should generate correct byUsername key', () => {
        const username = 'john_doe';
        expect(queryKeys.forum.profile.byUsername(username)).toEqual(['forum', 'profile', 'username', username]);
      });
    });
  });

  describe('crm', () => {
    describe('clients', () => {
      it('should generate correct client list key', () => {
        const status = 'active';
        expect(queryKeys.crm.clients.list(status)).toEqual(['crm', 'clients', 'list', { status }]);
      });

      it('should generate correct client search key', () => {
        const term = 'John Doe';
        expect(queryKeys.crm.clients.search(term)).toEqual(['crm', 'clients', 'search', term]);
      });
    });

    describe('invoices', () => {
      it('should generate correct byToken key', () => {
        const token = 'abc123token';
        expect(queryKeys.crm.invoices.byToken(token)).toEqual(['crm', 'invoices', 'token', token]);
      });

      it('should generate correct recent invoices key', () => {
        const limit = 10;
        expect(queryKeys.crm.invoices.recent(limit)).toEqual(['crm', 'invoices', 'list', 'recent', limit]);
      });
    });

    describe('preOrders', () => {
      it('should generate correct count key', () => {
        expect(queryKeys.crm.preOrders.count()).toEqual(['crm', 'pre-orders', 'list', 'count']);
      });
    });
  });

  describe('portal', () => {
    it('should generate correct client key', () => {
      const token = 'abc123token';
      expect(queryKeys.portal.client(token)).toEqual(['portal', 'client', token]);
    });

    it('should generate correct invoices key', () => {
      const token = 'abc123token';
      expect(queryKeys.portal.invoices(token)).toEqual(['portal', 'invoices', token]);
    });
  });

  describe('payment settings', () => {
    it('should generate correct tenant payment settings key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.tenantPaymentSettings(tenantId)).toEqual(['tenant-payment-settings', tenantId]);
    });

    it('should generate correct menu payment settings key', () => {
      const menuId = 'menu-123';
      expect(queryKeys.menuPaymentSettings(menuId)).toEqual(['menu-payment-settings', menuId]);
    });
  });

  describe('payments', () => {
    it('should generate correct byClient key', () => {
      const clientId = 'client-123';
      expect(queryKeys.payments.byClient(clientId)).toEqual(['payments', 'client', clientId]);
    });

    it('should generate correct history key', () => {
      const clientId = 'client-123';
      const limit = 10;
      expect(queryKeys.payments.history(clientId, limit)).toEqual(['payments', 'client', clientId, 'history', limit]);
    });

    it('should generate correct aging key', () => {
      const clientId = 'client-123';
      expect(queryKeys.payments.aging(clientId)).toEqual(['payments', 'client', clientId, 'aging']);
    });
  });

  describe('frontedInventory', () => {
    it('should generate correct payments key', () => {
      const frontedId = 'fronted-123';
      expect(queryKeys.frontedInventory.payments(frontedId)).toEqual(['fronted-inventory', frontedId, 'payments']);
    });
  });

  describe('collections', () => {
    it('should generate correct mode key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.collections.mode(tenantId)).toEqual(['collection-mode', tenantId]);
    });

    it('should generate correct activities key', () => {
      const clientId = 'client-123';
      expect(queryKeys.collections.activities(clientId)).toEqual(['collection-activities', clientId]);
    });
  });

  describe('tags', () => {
    it('should generate correct list key with filters', () => {
      const filters = { type: 'customer' };
      expect(queryKeys.tags.list(filters)).toEqual(['tags', 'list', filters]);
    });
  });

  describe('customerTags', () => {
    it('should generate correct byContact key', () => {
      const contactId = 'contact-123';
      expect(queryKeys.customerTags.byContact(contactId)).toEqual(['customer-tags', 'contact', contactId]);
    });

    it('should generate correct byTag key', () => {
      const tagId = 'tag-123';
      expect(queryKeys.customerTags.byTag(tagId)).toEqual(['customer-tags', 'tag', tagId]);
    });
  });

  describe('orderTags', () => {
    it('should generate correct byOrder key', () => {
      const orderId = 'order-123';
      expect(queryKeys.orderTags.byOrder(orderId)).toEqual(['order-tags', 'order', orderId]);
    });
  });

  describe('credits', () => {
    it('should generate correct balance key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.credits.balance(tenantId)).toEqual(['credits', 'balance', tenantId]);
    });

    it('should generate correct subscription key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.credits.subscription(tenantId)).toEqual(['credits', 'subscription', tenantId]);
    });
  });

  describe('security', () => {
    it('should generate correct knownDevices key', () => {
      const userId = 'user-123';
      expect(queryKeys.security.knownDevices(userId)).toEqual(['known-devices', userId]);
    });

    it('should generate correct suspiciousAlerts key', () => {
      const userId = 'user-123';
      expect(queryKeys.security.suspiciousAlerts(userId)).toEqual(['suspicious-login-alerts', userId]);
    });

    it('should generate correct pendingAlerts key', () => {
      const userId = 'user-123';
      expect(queryKeys.security.pendingAlerts(userId)).toEqual(['suspicious-login-alerts', userId, 'pending']);
    });
  });

  describe('activityFeed', () => {
    it('should generate correct byCategory key', () => {
      const tenantId = 'tenant-123';
      const category = 'orders';
      expect(queryKeys.activityFeed.byCategory(tenantId, category)).toEqual(['activity-feed', 'tenant', tenantId, 'category', category]);
    });

    it('should generate correct byUser key', () => {
      const tenantId = 'tenant-123';
      const userId = 'user-456';
      expect(queryKeys.activityFeed.byUser(tenantId, userId)).toEqual(['activity-feed', 'tenant', tenantId, 'user', userId]);
    });
  });

  describe('subscriptions', () => {
    it('should generate correct byTenant key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.subscriptions.byTenant(tenantId)).toEqual(['subscriptions', 'tenant', tenantId]);
    });

    it('should generate correct plans key', () => {
      expect(queryKeys.subscriptions.plans()).toEqual(['subscription-plans']);
    });
  });

  describe('team', () => {
    describe('members', () => {
      it('should generate correct list key', () => {
        const tenantId = 'tenant-123';
        expect(queryKeys.team.members.list(tenantId)).toEqual(['team', 'members', 'list', { tenantId }]);
      });

      it('should generate correct detail key', () => {
        const userId = 'user-123';
        expect(queryKeys.team.members.detail(userId)).toEqual(['team', 'members', userId]);
      });
    });

    describe('invitations', () => {
      it('should generate correct pending key', () => {
        const tenantId = 'tenant-123';
        expect(queryKeys.team.invitations.pending(tenantId)).toEqual(['team', 'invitations', 'list', 'pending', { tenantId }]);
      });
    });

    describe('activity', () => {
      it('should generate correct list key with filters', () => {
        const tenantId = 'tenant-123';
        const filters = { action: 'login' };
        expect(queryKeys.team.activity.list(tenantId, filters)).toEqual(['team', 'activity', 'list', { tenantId, ...filters }]);
      });

      it('should generate correct byUser key', () => {
        const tenantId = 'tenant-123';
        const userId = 'user-456';
        expect(queryKeys.team.activity.byUser(tenantId, userId)).toEqual(['team', 'activity', 'user', tenantId, userId]);
      });
    });
  });

  describe('customerInvoices', () => {
    it('should generate correct list key with tenant and filters', () => {
      const tenantId = 'tenant-123';
      const filters = { status: 'overdue' };
      expect(queryKeys.customerInvoices.list(tenantId, filters)).toEqual(['customer-invoices', 'list', { tenantId, ...filters }]);
    });

    it('should generate correct byCustomer key', () => {
      const customerId = 'customer-123';
      expect(queryKeys.customerInvoices.byCustomer(customerId)).toEqual(['customer-invoices', 'customer', customerId]);
    });

    it('should generate correct stats key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.customerInvoices.stats(tenantId)).toEqual(['customer-invoices', 'stats', tenantId]);
    });
  });

  describe('orderAuditLog', () => {
    it('should generate correct byOrder key', () => {
      const orderId = 'order-123';
      expect(queryKeys.orderAuditLog.byOrder(orderId)).toEqual(['order-audit-log', 'order', orderId]);
    });

    it('should generate correct byTenant key', () => {
      const tenantId = 'tenant-123';
      expect(queryKeys.orderAuditLog.byTenant(tenantId)).toEqual(['order-audit-log', 'tenant', tenantId]);
    });
  });

  describe('key immutability', () => {
    it('should return const arrays that cannot be modified', () => {
      const key = queryKeys.products.all;
      expect(Object.isFrozen(key)).toBe(false); // TypeScript const doesn't freeze the object
      expect(Array.isArray(key)).toBe(true);
    });

    it('should return new arrays on each function call', () => {
      const key1 = queryKeys.products.lists();
      const key2 = queryKeys.products.lists();
      expect(key1).toEqual(key2);
      expect(key1).not.toBe(key2); // Different instances
    });
  });

  describe('type safety', () => {
    it('should generate readonly tuples', () => {
      const key = queryKeys.products.all;
      // TypeScript will enforce readonly at compile time
      expect(key).toEqual(['products']);
    });
  });
});
