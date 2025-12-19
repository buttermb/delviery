/**
 * Unified Shop Cart Hook
 * Single source of truth for cart management in the storefront
 * Syncs with localStorage and ShopLayout context
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';

export interface ShopCartItem {
    productId: string;
    quantity: number;
    price: number;
    name: string;
    imageUrl: string | null;
    variant?: string;
}

const getCartKey = (storeId: string) => `shop_cart_${storeId}`;
const GUEST_CART_KEY = 'guest_cart';

interface UseShopCartOptions {
    storeId: string | undefined;
    onCartChange?: (count: number) => void;
}

export function useShopCart({ storeId, onCartChange }: UseShopCartOptions) {
    const [cartItems, setCartItems] = useState<ShopCartItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load cart from localStorage
    const loadCart = useCallback((): ShopCartItem[] => {
        if (!storeId) return [];

        try {
            const cartKey = getCartKey(storeId);
            const savedCart = safeStorage.getItem(cartKey);

            if (savedCart) {
                const parsed = JSON.parse(savedCart);
                return Array.isArray(parsed) ? parsed : [];
            }

            // Migration: check for old guest_cart format and migrate
            const guestCart = safeStorage.getItem(GUEST_CART_KEY);
            if (guestCart) {
                try {
                    const parsed = JSON.parse(guestCart);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Convert guest cart format to shop cart format if needed
                        const migrated = parsed.map((item: any) => ({
                            productId: item.product_id || item.productId,
                            quantity: item.quantity || 1,
                            price: item.price || 0,
                            name: item.name || 'Unknown Product',
                            imageUrl: item.imageUrl || item.image_url || null,
                            variant: item.selected_weight || item.variant,
                        }));
                        // Save migrated cart and clear old
                        safeStorage.setItem(cartKey, JSON.stringify(migrated));
                        safeStorage.removeItem(GUEST_CART_KEY);
                        logger.info('Migrated guest cart to shop cart', { storeId, itemCount: migrated.length });
                        return migrated;
                    }
                } catch (e) {
                    logger.error('Failed to migrate guest cart', e);
                }
            }

            return [];
        } catch (e) {
            logger.error('Failed to load cart', e);
            return [];
        }
    }, [storeId]);

    // Save cart to localStorage
    const saveCart = useCallback((items: ShopCartItem[]) => {
        if (!storeId) return;

        try {
            const cartKey = getCartKey(storeId);
            safeStorage.setItem(cartKey, JSON.stringify(items));
            setCartItems(items);

            const count = items.reduce((sum, item) => sum + item.quantity, 0);
            onCartChange?.(count);

            // Dispatch event for cross-component sync
            window.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: { cart: items, storeId, count }
            }));
        } catch (e) {
            logger.error('Failed to save cart', e);
        }
    }, [storeId, onCartChange]);

    // Initialize cart on mount
    useEffect(() => {
        if (storeId && !isInitialized) {
            const items = loadCart();
            setCartItems(items);
            const count = items.reduce((sum, item) => sum + item.quantity, 0);
            onCartChange?.(count);
            setIsInitialized(true);
        }
    }, [storeId, loadCart, onCartChange, isInitialized]);

    // Listen for cart updates from other components
    useEffect(() => {
        const handleCartUpdate = (event: CustomEvent) => {
            if (event.detail?.storeId === storeId) {
                setCartItems(event.detail.cart || []);
            }
        };

        window.addEventListener('cartUpdated', handleCartUpdate as EventListener);
        return () => window.removeEventListener('cartUpdated', handleCartUpdate as EventListener);
    }, [storeId]);

    // Add item to cart
    const addItem = useCallback((item: Omit<ShopCartItem, 'quantity'> & { quantity?: number }) => {
        const currentCart = loadCart(); // Always read fresh from storage
        const quantity = item.quantity || 1;

        const existingIndex = currentCart.findIndex(
            (cartItem) => cartItem.productId === item.productId && cartItem.variant === item.variant
        );

        let newCart: ShopCartItem[];
        if (existingIndex >= 0) {
            newCart = [...currentCart];
            newCart[existingIndex].quantity += quantity;
        } else {
            newCart = [...currentCart, { ...item, quantity }];
        }

        saveCart(newCart);
        return newCart;
    }, [loadCart, saveCart]);

    // Update item quantity
    const updateQuantity = useCallback((productId: string, delta: number, variant?: string) => {
        const currentCart = loadCart();

        const newCart = currentCart
            .map((item) => {
                if (item.productId === productId && item.variant === variant) {
                    const newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            })
            .filter((item) => item.quantity > 0);

        saveCart(newCart);
        return newCart;
    }, [loadCart, saveCart]);

    // Set exact quantity
    const setQuantity = useCallback((productId: string, quantity: number, variant?: string) => {
        const currentCart = loadCart();

        const newCart = currentCart
            .map((item) => {
                if (item.productId === productId && item.variant === variant) {
                    return { ...item, quantity: Math.max(0, quantity) };
                }
                return item;
            })
            .filter((item) => item.quantity > 0);

        saveCart(newCart);
        return newCart;
    }, [loadCart, saveCart]);

    // Remove item from cart
    const removeItem = useCallback((productId: string, variant?: string) => {
        const currentCart = loadCart();
        const newCart = currentCart.filter(
            (item) => !(item.productId === productId && item.variant === variant)
        );
        saveCart(newCart);
        return newCart;
    }, [loadCart, saveCart]);

    // Clear entire cart
    const clearCart = useCallback(() => {
        saveCart([]);
        return [];
    }, [saveCart]);

    // Get cart count
    const getCartCount = useCallback(() => {
        return cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }, [cartItems]);

    // Get cart subtotal
    const getSubtotal = useCallback(() => {
        return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }, [cartItems]);

    return {
        cartItems,
        cartCount: getCartCount(),
        subtotal: getSubtotal(),
        addItem,
        updateQuantity,
        setQuantity,
        removeItem,
        clearCart,
        isInitialized,
    };
}
