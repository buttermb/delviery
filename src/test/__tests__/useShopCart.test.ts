/**
 * useShopCart Hook Tests
 * Tests for cart operations: add, update, remove, clear, localStorage persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShopCart } from '@/hooks/useShopCart';

// Mock safeStorage
const mockStorage = new Map<string, string>();
vi.mock('@/utils/safeStorage', () => ({
  safeStorage: {
    getItem: (key: string) => mockStorage.get(key) || null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const TEST_STORE_ID = 'store-test-123';
const CART_KEY = `shop_cart_${TEST_STORE_ID}`;

const mockItem = {
  productId: 'prod-1',
  name: 'Test Product',
  price: 29.99,
  imageUrl: 'https://example.com/image.jpg',
};

const mockItemWithVariant = {
  productId: 'prod-2',
  name: 'Variant Product',
  price: 39.99,
  imageUrl: null,
  variant: '1/8 oz',
};

describe('useShopCart', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe('Initialization', () => {
    it('should initialize with empty cart when no stored data', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toEqual([]);
      expect(result.current.cartCount).toBe(0);
      expect(result.current.subtotal).toBe(0);
    });

    it('should load cart from localStorage on mount', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].productId).toBe('prod-1');
      expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it('should return empty cart when storeId is undefined', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: undefined })
      );

      expect(result.current.cartItems).toEqual([]);
      expect(result.current.cartCount).toBe(0);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockStorage.set(CART_KEY, 'not-valid-json{{{');

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toEqual([]);
    });

    it('should handle non-array localStorage data gracefully', () => {
      mockStorage.set(CART_KEY, JSON.stringify({ invalid: true }));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toEqual([]);
    });

    it('should call onCartChange with initial cart count', () => {
      const savedItems = [{ ...mockItem, quantity: 3 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const onCartChange = vi.fn();
      renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID, onCartChange })
      );

      expect(onCartChange).toHaveBeenCalledWith(3);
    });
  });

  describe('Add Item', () => {
    it('should add a new item to the cart', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem(mockItem);
      });

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].productId).toBe('prod-1');
      expect(result.current.cartItems[0].quantity).toBe(1);
      expect(result.current.cartItems[0].price).toBe(29.99);
    });

    it('should increment quantity when adding existing item', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem(mockItem);
      });
      act(() => {
        result.current.addItem(mockItem);
      });

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it('should add item with custom quantity', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem({ ...mockItem, quantity: 5 });
      });

      expect(result.current.cartItems[0].quantity).toBe(5);
    });

    it('should treat different variants as separate items', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem(mockItem);
      });
      act(() => {
        result.current.addItem(mockItemWithVariant);
      });

      expect(result.current.cartItems).toHaveLength(2);
    });

    it('should enforce max quantity per item (10)', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem({ ...mockItem, quantity: 15 });
      });

      expect(result.current.cartItems[0].quantity).toBe(10);
    });

    it('should cap at max when adding to existing item', () => {
      const savedItems = [{ ...mockItem, quantity: 8 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem({ ...mockItem, quantity: 5 });
      });

      expect(result.current.cartItems[0].quantity).toBe(10);
    });

    it('should persist added item to localStorage', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem(mockItem);
      });

      const stored = JSON.parse(mockStorage.get(CART_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].productId).toBe('prod-1');
    });
  });

  describe('Update Quantity', () => {
    it('should increment item quantity', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.updateQuantity('prod-1', 1);
      });

      expect(result.current.cartItems[0].quantity).toBe(3);
    });

    it('should decrement item quantity', () => {
      const savedItems = [{ ...mockItem, quantity: 3 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.updateQuantity('prod-1', -1);
      });

      expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it('should remove item when quantity reaches 0', () => {
      const savedItems = [{ ...mockItem, quantity: 1 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.updateQuantity('prod-1', -1);
      });

      expect(result.current.cartItems).toHaveLength(0);
    });

    it('should not go below 0 quantity', () => {
      const savedItems = [{ ...mockItem, quantity: 1 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.updateQuantity('prod-1', -5);
      });

      // Item should be removed (filtered out when quantity is 0)
      expect(result.current.cartItems).toHaveLength(0);
    });

    it('should update correct variant item', () => {
      const savedItems = [
        { ...mockItem, quantity: 2 },
        { ...mockItemWithVariant, quantity: 3 },
      ];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.updateQuantity('prod-2', 1, '1/8 oz');
      });

      expect(result.current.cartItems[0].quantity).toBe(2); // unchanged
      expect(result.current.cartItems[1].quantity).toBe(4); // incremented
    });

    it('should persist quantity changes to localStorage', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.updateQuantity('prod-1', 3);
      });

      const stored = JSON.parse(mockStorage.get(CART_KEY) || '[]');
      expect(stored[0].quantity).toBe(5);
    });
  });

  describe('Set Quantity', () => {
    it('should set exact quantity for an item', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.setQuantity('prod-1', 7);
      });

      expect(result.current.cartItems[0].quantity).toBe(7);
    });

    it('should cap at MAX_QUANTITY_PER_ITEM', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.setQuantity('prod-1', 25);
      });

      expect(result.current.cartItems[0].quantity).toBe(10);
    });

    it('should remove item when quantity set to 0', () => {
      const savedItems = [{ ...mockItem, quantity: 5 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.setQuantity('prod-1', 0);
      });

      expect(result.current.cartItems).toHaveLength(0);
    });
  });

  describe('Remove Item', () => {
    it('should remove item from cart', () => {
      const savedItems = [
        { ...mockItem, quantity: 2 },
        { ...mockItemWithVariant, quantity: 1 },
      ];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.removeItem('prod-1');
      });

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].productId).toBe('prod-2');
    });

    it('should remove correct variant', () => {
      const savedItems = [
        { ...mockItemWithVariant, quantity: 2, variant: '1/8 oz' },
        { ...mockItemWithVariant, productId: 'prod-2', quantity: 1, variant: '1/4 oz' },
      ];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.removeItem('prod-2', '1/8 oz');
      });

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].variant).toBe('1/4 oz');
    });

    it('should persist removal to localStorage', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.removeItem('prod-1');
      });

      const stored = JSON.parse(mockStorage.get(CART_KEY) || '[]');
      expect(stored).toHaveLength(0);
    });

    it('should call onCartChange with 0 when last item removed', () => {
      const savedItems = [{ ...mockItem, quantity: 1 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const onCartChange = vi.fn();
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID, onCartChange })
      );

      act(() => {
        result.current.removeItem('prod-1');
      });

      expect(onCartChange).toHaveBeenCalledWith(0);
    });
  });

  describe('Clear Cart', () => {
    it('should remove all items from cart', () => {
      const savedItems = [
        { ...mockItem, quantity: 2 },
        { ...mockItemWithVariant, quantity: 1 },
      ];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.clearCart();
      });

      expect(result.current.cartItems).toHaveLength(0);
      expect(result.current.cartCount).toBe(0);
      expect(result.current.subtotal).toBe(0);
    });

    it('should clear localStorage', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.clearCart();
      });

      const stored = JSON.parse(mockStorage.get(CART_KEY) || '[]');
      expect(stored).toHaveLength(0);
    });
  });

  describe('Subtotal Calculation', () => {
    it('should calculate subtotal correctly for single item', () => {
      const savedItems = [{ ...mockItem, quantity: 3 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.subtotal).toBeCloseTo(89.97, 2);
    });

    it('should calculate subtotal correctly for multiple items', () => {
      const savedItems = [
        { ...mockItem, quantity: 2 }, // 29.99 * 2 = 59.98
        { ...mockItemWithVariant, quantity: 1 }, // 39.99 * 1 = 39.99
      ];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.subtotal).toBeCloseTo(99.97, 2);
    });

    it('should return 0 for empty cart', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.subtotal).toBe(0);
    });
  });

  describe('Cart Count', () => {
    it('should count total quantity across all items', () => {
      const savedItems = [
        { ...mockItem, quantity: 2 },
        { ...mockItemWithVariant, quantity: 3 },
      ];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartCount).toBe(5);
    });

    it('should update count when items change', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem(mockItem);
      });
      expect(result.current.cartCount).toBe(1);

      act(() => {
        result.current.addItem({ ...mockItem, quantity: 3 });
      });
      expect(result.current.cartCount).toBe(4);
    });
  });

  describe('Cart Persistence (localStorage)', () => {
    it('should use store-specific cart key', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: 'store-abc' })
      );

      act(() => {
        result.current.addItem(mockItem);
      });

      expect(mockStorage.has('shop_cart_store-abc')).toBe(true);
    });

    it('should keep carts separate per store', () => {
      const { result: result1 } = renderHook(() =>
        useShopCart({ storeId: 'store-1' })
      );
      const { result: result2 } = renderHook(() =>
        useShopCart({ storeId: 'store-2' })
      );

      act(() => {
        result1.current.addItem(mockItem);
      });

      expect(result1.current.cartItems).toHaveLength(1);
      expect(result2.current.cartItems).toHaveLength(0);
    });

    it('should migrate guest_cart to store-specific cart', () => {
      const guestItems = [
        {
          product_id: 'prod-guest-1',
          quantity: 2,
          price: 19.99,
          name: 'Guest Product',
          image_url: null,
          selected_weight: '1/4 oz',
        },
      ];
      mockStorage.set('guest_cart', JSON.stringify(guestItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].productId).toBe('prod-guest-1');
      expect(result.current.cartItems[0].variant).toBe('1/4 oz');
      // guest_cart should be removed after migration
      expect(mockStorage.has('guest_cart')).toBe(false);
    });
  });

  describe('Gift Cards', () => {
    it('should apply a gift card', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.applyGiftCard({ code: 'GIFT50', balance: 50 });
      });

      expect(result.current.appliedGiftCards).toHaveLength(1);
      expect(result.current.appliedGiftCards[0].code).toBe('GIFT50');
    });

    it('should not duplicate gift cards', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.applyGiftCard({ code: 'GIFT50', balance: 50 });
      });
      act(() => {
        result.current.applyGiftCard({ code: 'GIFT50', balance: 50 });
      });

      expect(result.current.appliedGiftCards).toHaveLength(1);
    });

    it('should remove a gift card', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.applyGiftCard({ code: 'GIFT50', balance: 50 });
      });
      act(() => {
        result.current.removeGiftCard('GIFT50');
      });

      expect(result.current.appliedGiftCards).toHaveLength(0);
    });

    it('should calculate gift card total correctly', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.applyGiftCard({ code: 'GIFT30', balance: 30 });
        result.current.applyGiftCard({ code: 'GIFT20', balance: 20 });
      });

      // For a $40 order, should apply $30 from first + $10 from second = $40
      expect(result.current.getGiftCardTotal(40)).toBe(40);
    });

    it('should not apply more than order total', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.applyGiftCard({ code: 'GIFT100', balance: 100 });
      });

      // For a $50 order, should only apply $50
      expect(result.current.getGiftCardTotal(50)).toBe(50);
    });
  });

  describe('Coupon Discount Calculation', () => {
    it('should return 0 when no coupon applied', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.getCouponDiscount(100)).toBe(0);
    });
  });

  describe('cartUpdated Event', () => {
    it('should dispatch cartUpdated event on save', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      act(() => {
        result.current.addItem(mockItem);
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cartUpdated',
        })
      );

      dispatchSpy.mockRestore();
    });
  });

  describe('Empty State', () => {
    it('should show empty state with 0 count and 0 subtotal', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toEqual([]);
      expect(result.current.cartCount).toBe(0);
      expect(result.current.subtotal).toBe(0);
      expect(result.current.isInitialized).toBe(true);
    });
  });

  describe('Store Switching', () => {
    it('should reload cart when storeId changes', () => {
      // Pre-populate carts for two stores
      const store1Items = [{ ...mockItem, quantity: 2 }];
      const store2Items = [{ ...mockItemWithVariant, quantity: 3 }];
      mockStorage.set('shop_cart_store-1', JSON.stringify(store1Items));
      mockStorage.set('shop_cart_store-2', JSON.stringify(store2Items));

      let storeId = 'store-1';
      const { result, rerender } = renderHook(() =>
        useShopCart({ storeId })
      );

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].productId).toBe('prod-1');

      // Switch store
      storeId = 'store-2';
      rerender();

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].productId).toBe('prod-2');
    });

    it('should reset gift cards and coupons when storeId changes', () => {
      let storeId = 'store-1';
      const { result, rerender } = renderHook(() =>
        useShopCart({ storeId })
      );

      act(() => {
        result.current.applyGiftCard({ code: 'GIFT50', balance: 50 });
      });
      expect(result.current.appliedGiftCards).toHaveLength(1);

      // Switch store
      storeId = 'store-2';
      rerender();

      expect(result.current.appliedGiftCards).toHaveLength(0);
    });
  });

  describe('Cross-Tab Persistence', () => {
    it('should update cart when storage event fires for matching key', () => {
      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toHaveLength(0);

      // Simulate another tab updating localStorage
      const newItems = [{ ...mockItem, quantity: 4 }];
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: CART_KEY,
          newValue: JSON.stringify(newItems),
        }));
      });

      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].quantity).toBe(4);
    });

    it('should clear cart when storage event has null newValue', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      expect(result.current.cartItems).toHaveLength(1);

      // Simulate another tab clearing the cart key
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: CART_KEY,
          newValue: null,
        }));
      });

      expect(result.current.cartItems).toHaveLength(0);
      expect(result.current.cartCount).toBe(0);
    });

    it('should ignore storage events for other keys', () => {
      const savedItems = [{ ...mockItem, quantity: 2 }];
      mockStorage.set(CART_KEY, JSON.stringify(savedItems));

      const { result } = renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID })
      );

      // Simulate storage event for a different store's cart
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'shop_cart_other-store',
          newValue: JSON.stringify([{ ...mockItem, quantity: 99 }]),
        }));
      });

      // Should be unchanged
      expect(result.current.cartItems).toHaveLength(1);
      expect(result.current.cartItems[0].quantity).toBe(2);
    });

    it('should call onCartChange when cross-tab update occurs', () => {
      const onCartChange = vi.fn();
      renderHook(() =>
        useShopCart({ storeId: TEST_STORE_ID, onCartChange })
      );

      const newItems = [{ ...mockItem, quantity: 5 }];
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: CART_KEY,
          newValue: JSON.stringify(newItems),
        }));
      });

      expect(onCartChange).toHaveBeenCalledWith(5);
    });
  });
});
