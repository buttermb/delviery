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
    metrcRetailId?: string | null;
    excludeFromDiscounts?: boolean;
    minimumPrice?: number;
    minExpiryDays?: number;
}

const getCartKey = (storeId: string) => `shop_cart_${storeId}`;
const GUEST_CART_KEY = 'guest_cart';
const MAX_QUANTITY_PER_ITEM = 10; // Maximum quantity per product in cart

interface UseShopCartOptions {
    storeId: string | undefined;
    onCartChange?: (count: number) => void;
}

export interface AppliedGiftCard {
    code: string;
    balance: number;
}

interface AppliedCoupon {
    coupon_id: string;
    code: string;
    discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
    discount_value: number;
    calculated_discount: number;
    free_shipping: boolean;
}

interface CartValidationResult {
    valid: boolean;
    issues: Array<{
        product_id: string;
        issue: string;
        message: string;
        old_price?: number;
        new_price?: number;
        available?: number;
    }>;
    validated_items: Array<{
        product_id: string;
        name: string;
        quantity: number;
        price: number;
        in_stock: boolean;
    }>;
}

export function useShopCart({ storeId, onCartChange }: UseShopCartOptions) {
    const [cartItems, setCartItems] = useState<ShopCartItem[]>([]);
    const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [lastValidation, setLastValidation] = useState<CartValidationResult | null>(null);

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
            const newQuantity = currentCart[existingIndex].quantity + quantity;
            // Enforce max quantity limit
            if (newQuantity > MAX_QUANTITY_PER_ITEM) {
                logger.warn('Max quantity reached', { productId: item.productId, maxQuantity: MAX_QUANTITY_PER_ITEM });
                newCart = [...currentCart];
                newCart[existingIndex].quantity = MAX_QUANTITY_PER_ITEM;
            } else {
                newCart = [...currentCart];
                newCart[existingIndex].quantity = newQuantity;
            }
        } else {
            // Enforce max quantity on new item too
            const cappedQuantity = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
            newCart = [...currentCart, { ...item, quantity: cappedQuantity }];
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
        // Enforce max quantity limit
        const cappedQuantity = Math.min(Math.max(0, quantity), MAX_QUANTITY_PER_ITEM);

        const newCart = currentCart
            .map((item) => {
                if (item.productId === productId && item.variant === variant) {
                    return { ...item, quantity: cappedQuantity };
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

    // Apply Gift Card
    const applyGiftCard = useCallback((card: AppliedGiftCard) => {
        setAppliedGiftCards(prev => {
            if (prev.some(c => c.code === card.code)) return prev;
            return [...prev, card];
        });
    }, []);

    // Remove Gift Card
    const removeGiftCard = useCallback((code: string) => {
        setAppliedGiftCards(prev => prev.filter(c => c.code !== code));
    }, []);

    // Get total gift card value applied
    const getGiftCardTotal = useCallback((orderTotal: number) => {
        let remainingTotal = orderTotal;
        let totalApplied = 0;

        // Apply cards in order
        appliedGiftCards.forEach(card => {
            const deduction = Math.min(remainingTotal, card.balance);
            totalApplied += deduction;
            remainingTotal -= deduction;
        });

        return totalApplied;
    }, [appliedGiftCards]);

    // Validate cart items against current stock/prices (calls RPC)
    const validateCart = useCallback(async (): Promise<CartValidationResult | null> => {
        if (!storeId || cartItems.length === 0) return null;

        try {
            // Dynamic import to avoid circular deps
            const { supabase } = await import('@/integrations/supabase/client');

            const itemsPayload = cartItems.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                price: item.price
            }));

            const { data, error } = await supabase.rpc('validate_cart_items', {
                p_store_id: storeId,
                p_items: itemsPayload
            });

            if (error) {
                logger.error('Cart validation failed', error);
                return null;
            }

            const result = data as CartValidationResult;
            setLastValidation(result);
            return result;
        } catch (e) {
            logger.error('Cart validation error', e);
            return null;
        }
    }, [storeId, cartItems]);

    // Apply coupon code
    const applyCoupon = useCallback(async (code: string, subtotal: number): Promise<{ success: boolean; error?: string; coupon?: AppliedCoupon }> => {
        if (!storeId) return { success: false, error: 'No store' };

        try {
            const { supabase } = await import('@/integrations/supabase/client');

            const { data, error } = await supabase.rpc('validate_coupon', {
                p_store_id: storeId,
                p_code: code,
                p_subtotal: subtotal,
                p_cart_items: cartItems.map(i => ({ product_id: i.productId, quantity: i.quantity }))
            });

            if (error) {
                logger.error('Coupon validation failed', error);
                return { success: false, error: 'Failed to validate coupon' };
            }

            if (!data.valid) {
                return { success: false, error: data.error };
            }

            const coupon: AppliedCoupon = {
                coupon_id: data.coupon_id,
                code: data.code,
                discount_type: data.discount_type,
                discount_value: data.discount_value,
                calculated_discount: data.calculated_discount,
                free_shipping: data.free_shipping
            };

            setAppliedCoupon(coupon);
            return { success: true, coupon };
        } catch (e) {
            logger.error('Coupon apply error', e);
            return { success: false, error: 'Failed to apply coupon' };
        }
    }, [storeId, cartItems]);

    // Remove applied coupon
    const removeCoupon = useCallback(() => {
        setAppliedCoupon(null);
    }, []);

    // Get discount amount from coupon
    const getCouponDiscount = useCallback((subtotal: number): number => {
        if (!appliedCoupon) return 0;

        if (appliedCoupon.discount_type === 'percentage') {
            return Math.min(subtotal * (appliedCoupon.discount_value / 100), appliedCoupon.calculated_discount);
        } else if (appliedCoupon.discount_type === 'fixed_amount') {
            return Math.min(appliedCoupon.discount_value, subtotal);
        }
        return 0;
    }, [appliedCoupon]);

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
        // Gift cards
        appliedGiftCards,
        applyGiftCard,
        removeGiftCard,
        getGiftCardTotal,
        setAppliedGiftCards,
        // Coupons
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        getCouponDiscount,
        // Validation
        validateCart,
        lastValidation,
        // Constants
        MAX_QUANTITY_PER_ITEM
    };
}
