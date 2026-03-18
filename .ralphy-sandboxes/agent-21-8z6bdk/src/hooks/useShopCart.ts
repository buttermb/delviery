/**
 * Unified Shop Cart Hook
 * Single source of truth for cart management in the storefront
 * Syncs with localStorage and ShopLayout context
 * Includes inventory validation for real-time stock checking
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { safeStorage } from '@/utils/safeStorage';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/constants/storageKeys';

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

const getCartKey = (storeId: string) => `${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`;
const GUEST_CART_KEY = STORAGE_KEYS.GUEST_CART;
const getCouponKey = (storeId: string) => `${STORAGE_KEYS.SHOP_COUPON_PREFIX}${storeId}`;
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

    // Stable ref for onCartChange to avoid re-triggering effects
    const onCartChangeRef = useRef(onCartChange);
    onCartChangeRef.current = onCartChange;

    // Track previous storeId to detect changes
    const prevStoreIdRef = useRef(storeId);

    // Reset initialization when storeId changes
    useEffect(() => {
        if (prevStoreIdRef.current !== storeId) {
            prevStoreIdRef.current = storeId;
            setIsInitialized(false);
            setCartItems([]);
            setAppliedCoupon(null);
            setAppliedGiftCards([]);
        }
    }, [storeId]);

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
                        const migrated = parsed.map((item: Record<string, unknown>) => ({
                            productId: (item.product_id || item.productId) as string,
                            quantity: (item.quantity as number) || 1,
                            price: (item.price as number) || 0,
                            name: (item.name as string) || 'Unknown Product',
                            imageUrl: (item.imageUrl || item.image_url || null) as string | null,
                            variant: (item.selected_weight || item.variant) as string | undefined,
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
            onCartChangeRef.current?.(count);

            // Dispatch event for cross-component sync
            window.dispatchEvent(new CustomEvent('cartUpdated', {
                detail: { cart: items, storeId, count }
            }));
        } catch (e) {
            logger.error('Failed to save cart', e);
        }
    }, [storeId]);

    // Initialize cart on mount or when storeId changes
    useEffect(() => {
        if (storeId && !isInitialized) {
            const items = loadCart();
            setCartItems(items);
            const count = items.reduce((sum, item) => sum + item.quantity, 0);
            onCartChangeRef.current?.(count);
            setIsInitialized(true);
        }
    }, [storeId, loadCart, isInitialized]);

    // Listen for cart updates from other components
    useEffect(() => {
        const handleCartUpdate = (event: CustomEvent) => {
            if (event.detail?.storeId === storeId) {
                setCartItems(event.detail.cart ?? []);
            }
        };

        window.addEventListener('cartUpdated', handleCartUpdate as EventListener);
        return () => window.removeEventListener('cartUpdated', handleCartUpdate as EventListener);
    }, [storeId]);

    // Listen for localStorage changes from other tabs
    useEffect(() => {
        if (!storeId) return;

        const cartKey = getCartKey(storeId);

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key !== cartKey) return;

            try {
                if (!event.newValue) {
                    setCartItems([]);
                    onCartChangeRef.current?.(0);
                    return;
                }
                const parsed = JSON.parse(event.newValue);
                const items: ShopCartItem[] = Array.isArray(parsed) ? parsed : [];
                setCartItems(items);
                const count = items.reduce((sum, item) => sum + item.quantity, 0);
                onCartChangeRef.current?.(count);
            } catch (e) {
                logger.error('Failed to handle cross-tab cart update', e);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [storeId]);

    // Load saved coupon from localStorage
    useEffect(() => {
        if (storeId && isInitialized) {
            try {
                const savedCoupon = safeStorage.getItem(getCouponKey(storeId));
                if (savedCoupon) {
                    setAppliedCoupon(JSON.parse(savedCoupon));
                }
            } catch (e) {
                logger.error('Failed to load saved coupon', e);
            }
        }
    }, [storeId, isInitialized]);

    // Persist coupon to localStorage
    const persistCoupon = useCallback((coupon: AppliedCoupon | null) => {
        if (!storeId) return;
        try {
            const key = getCouponKey(storeId);
            if (coupon) {
                safeStorage.setItem(key, JSON.stringify(coupon));
            } else {
                safeStorage.removeItem(key);
            }
        } catch (e) {
            logger.error('Failed to persist coupon', e);
        }
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
        setAppliedCoupon(null);
        persistCoupon(null);
        return [];
    }, [saveCart, persistCoupon]);

    // Memoized cart count
    const cartCount = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
        [cartItems]
    );

    // Memoized cart subtotal
    const subtotal = useMemo(
        () => cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        [cartItems]
    );

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
            const itemsPayload = cartItems.map(item => ({
                product_id: item.productId,
                quantity: item.quantity,
                price: item.price
            }));

            const { data, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)('validate_cart_items', {
                p_store_id: storeId,
                p_items: itemsPayload
            });

            if (error) {
                logger.error('Cart validation failed', error);
                return null;
            }

            const result = data as unknown as CartValidationResult;
            setLastValidation(result);
            return result;
        } catch (e) {
            logger.error('Cart validation error', e);
            return null;
        }
    }, [storeId, cartItems]);

    // Sync cart prices with server — returns list of items that had price changes
    const syncCartPrices = useCallback(async (): Promise<{
        changed: boolean;
        priceChanges: Array<{ productId: string; name: string; oldPrice: number; newPrice: number }>;
    }> => {
        if (!storeId || cartItems.length === 0) {
            return { changed: false, priceChanges: [] };
        }

        try {
            const productIds = cartItems.map(item => item.productId);
            const { data, error } = await supabase
                .from('products')
                .select('id, price')
                .in('id', productIds);

            if (error || !data) {
                logger.warn('Failed to fetch current prices for cart sync', error);
                return { changed: false, priceChanges: [] };
            }

            const priceMap = new Map<string, number>(data.map(p => [p.id, Number(p.price as any)]));
            const priceChanges: Array<{ productId: string; name: string; oldPrice: number; newPrice: number }> = [];
            let hasChanges = false;

            const updatedCart = cartItems.map(item => {
                const currentPrice = priceMap.get(item.productId) as number | undefined;
                if (currentPrice !== undefined && Math.abs(currentPrice - item.price) > 0.01) {
                    priceChanges.push({
                        productId: item.productId,
                        name: item.name,
                        oldPrice: item.price,
                        newPrice: currentPrice,
                    });
                    hasChanges = true;
                    return { ...item, price: currentPrice } as ShopCartItem;
                }
                return item;
            });

            if (hasChanges) {
                saveCart(updatedCart as ShopCartItem[]);
                logger.info('Cart prices synced with server', { priceChanges });
            }

            return { changed: hasChanges, priceChanges };
        } catch (e) {
            logger.error('Error syncing cart prices', e);
            return { changed: false, priceChanges: [] };
        }
    }, [storeId, cartItems, saveCart]);

    // Quick inventory check - validates stock availability without full cart validation
    const checkInventoryAvailability = useCallback(async (): Promise<{
        valid: boolean;
        outOfStock: Array<{ productId: string; name: string; available: number; requested: number }>;
        lowStock: Array<{ productId: string; name: string; available: number }>;
    }> => {
        if (!storeId || cartItems.length === 0) {
            return { valid: true, outOfStock: [], lowStock: [] };
        }

        try {
            const productIds = cartItems.map(item => item.productId);

            // Query products directly for stock info
            const { data, error } = await supabase
                .from('products')
                .select('id, name, stock_quantity, available_quantity')
                .in('id', productIds);

            if (error) {
                logger.warn('Failed to check inventory availability', error);
                // Don't block checkout on validation failure - just log
                return { valid: true, outOfStock: [], lowStock: [] };
            }

            const outOfStock: Array<{ productId: string; name: string; available: number; requested: number }> = [];
            const lowStock: Array<{ productId: string; name: string; available: number }> = [];

            for (const item of cartItems) {
                const product = data?.find(p => p.id === item.productId);
                // Use available_quantity if set, otherwise fall back to stock_quantity
                const available = product?.available_quantity ?? product?.stock_quantity ?? 0;

                if (available < item.quantity) {
                    outOfStock.push({
                        productId: item.productId,
                        name: item.name,
                        available,
                        requested: item.quantity,
                    });
                } else if (available > 0 && available <= 5) {
                    lowStock.push({
                        productId: item.productId,
                        name: item.name,
                        available,
                    });
                }
            }

            return {
                valid: outOfStock.length === 0,
                outOfStock,
                lowStock,
            };
        } catch (e) {
            logger.error('Error checking inventory availability', e);
            return { valid: true, outOfStock: [], lowStock: [] };
        }
    }, [storeId, cartItems]);

    // Apply coupon code via marketplace coupon validation
    const applyCoupon = useCallback(async (code: string, currentSubtotal: number): Promise<{ success: boolean; error?: string; coupon?: AppliedCoupon }> => {
        if (!storeId) return { success: false, error: 'No store' };

        try {
            const { data, error } = await (supabase.rpc as unknown as (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)('validate_marketplace_coupon', {
                p_store_id: storeId,
                p_code: code,
                p_subtotal: currentSubtotal,
            });

            if (error) {
                const rpcError = error as { message?: string; code?: string };
                if (rpcError.message?.includes('function') || rpcError.code === '42883') {
                    return { success: false, error: 'Coupons not available for this store' };
                }
                logger.error('Coupon validation failed', error);
                return { success: false, error: 'Failed to validate coupon' };
            }

            const results = data as Array<{ is_valid?: boolean; discount_amount?: number; discount_type?: string; error_message?: string; coupon_id?: string; discount_value?: number; free_shipping?: boolean }> | null;
            const result = results?.[0];

            if (!result?.is_valid) {
                return { success: false, error: result?.error_message || 'Invalid coupon' };
            }

            const coupon: AppliedCoupon = {
                coupon_id: result.coupon_id ?? '',
                code: code.toUpperCase(),
                discount_type: (result.discount_type === 'fixed' ? 'fixed_amount' : result.discount_type || 'percentage') as AppliedCoupon['discount_type'],
                discount_value: result.discount_value || result.discount_amount || 0,
                calculated_discount: result.discount_amount ?? 0,
                free_shipping: result.free_shipping ?? false
            };

            setAppliedCoupon(coupon);
            persistCoupon(coupon);
            return { success: true, coupon };
        } catch (e) {
            logger.error('Coupon apply error', e);
            return { success: false, error: 'Failed to apply coupon' };
        }
    }, [storeId, persistCoupon]);

    // Remove applied coupon
    const removeCoupon = useCallback(() => {
        setAppliedCoupon(null);
        persistCoupon(null);
    }, [persistCoupon]);

    // Get discount amount from coupon
    const getCouponDiscount = useCallback((currentSubtotal: number): number => {
        if (!appliedCoupon) return 0;
        // Use pre-calculated discount from validation RPC, capped at subtotal
        if (appliedCoupon.calculated_discount > 0) {
            return Math.min(appliedCoupon.calculated_discount, currentSubtotal);
        }
        // Fallback calculation
        if (appliedCoupon.discount_type === 'percentage') {
            return Math.min(currentSubtotal * (appliedCoupon.discount_value / 100), currentSubtotal);
        } else if (appliedCoupon.discount_type === 'fixed_amount') {
            return Math.min(appliedCoupon.discount_value, currentSubtotal);
        }
        return 0;
    }, [appliedCoupon]);

    return {
        cartItems,
        cartCount,
        subtotal,
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
        checkInventoryAvailability,
        syncCartPrices,
        // Constants
        MAX_QUANTITY_PER_ITEM
    };
}
