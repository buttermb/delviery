/**
 * Promotion Calculation Utilities
 * Calculate discounts for advanced promotion types
 */

export interface CartItem {
    productId: string;
    price: number;
    quantity: number;
    name?: string;
}

export interface Promotion {
    id: string;
    code: string;
    promotion_type: 'fixed_discount' | 'percentage_discount' | 'buy_x_get_y' | 'spending_threshold' | 'free_shipping';
    discount_value: number;
    buy_quantity?: number;
    get_quantity?: number;
    get_discount_percent?: number;
    min_purchase_amount?: number;
    max_discount_amount?: number;
    target_type?: string;
    target_ids?: string[];
    conditions?: {
        min_items?: number;
        max_uses_per_customer?: number;
        customer_groups?: string[];
        excluded_products?: string[];
        first_time_customers_only?: boolean;
    };
}

export interface PromotionResult {
    promotionId: string;
    promotionCode: string;
    discountAmount: number;
    freeShipping: boolean;
    message: string;
    isValid: boolean;
    errorMessage?: string;
}

/**
 * Calculate discount for a promotion
 */
export function calculatePromotionDiscount(
    promotion: Promotion,
    cartItems: CartItem[],
    subtotal: number,
    _customerId?: string
): PromotionResult {
    const result: PromotionResult = {
        promotionId: promotion.id,
        promotionCode: promotion.code,
        discountAmount: 0,
        freeShipping: false,
        message: '',
        isValid: false,
    };

    // Check minimum purchase for spending threshold
    if (promotion.promotion_type === 'spending_threshold') {
        if (promotion.min_purchase_amount && subtotal < promotion.min_purchase_amount) {
            result.errorMessage = `Minimum purchase of $${promotion.min_purchase_amount.toFixed(2)} required`;
            return result;
        }
    }

    // Check minimum items condition
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    if (promotion.conditions?.min_items && totalItems < promotion.conditions.min_items) {
        result.errorMessage = `Minimum ${promotion.conditions.min_items} items required`;
        return result;
    }

    // Check excluded products
    if (promotion.conditions?.excluded_products && promotion.conditions.excluded_products.length > 0) {
        const hasExcluded = cartItems.some(item =>
            promotion.conditions?.excluded_products?.includes(item.productId)
        );
        if (hasExcluded) {
            result.errorMessage = 'Some items in your cart are excluded from this promotion';
            return result;
        }
    }

    // Calculate discount based on promotion type
    result.isValid = true;

    switch (promotion.promotion_type) {
        case 'fixed_discount':
            result.discountAmount = promotion.discount_value;
            result.message = `$${promotion.discount_value.toFixed(2)} off`;
            break;

        case 'percentage_discount':
            result.discountAmount = subtotal * (promotion.discount_value / 100);
            if (promotion.max_discount_amount && result.discountAmount > promotion.max_discount_amount) {
                result.discountAmount = promotion.max_discount_amount;
                result.message = `${promotion.discount_value}% off (max $${promotion.max_discount_amount.toFixed(2)})`;
            } else {
                result.message = `${promotion.discount_value}% off`;
            }
            break;

        case 'buy_x_get_y':
            const bxgyDiscount = calculateBuyXGetYDiscount(
                cartItems,
                promotion.buy_quantity || 0,
                promotion.get_quantity || 0,
                promotion.get_discount_percent || 0
            );
            result.discountAmount = bxgyDiscount.discount;
            result.message = `Buy ${promotion.buy_quantity}, get ${promotion.get_quantity} at ${promotion.get_discount_percent}% off`;

            if (bxgyDiscount.sets === 0) {
                result.isValid = false;
                result.errorMessage = `Add ${promotion.buy_quantity} items to qualify`;
                return result;
            }
            break;

        case 'spending_threshold':
            result.discountAmount = promotion.discount_value;
            result.message = `Spend $${promotion.min_purchase_amount?.toFixed(2)}, get $${promotion.discount_value.toFixed(2)} off`;
            break;

        case 'free_shipping':
            result.freeShipping = true;
            result.discountAmount = 0; // Shipping discount calculated separately
            result.message = 'Free shipping';
            break;
    }

    // Cap discount at subtotal (can't be negative)
    result.discountAmount = Math.min(result.discountAmount, subtotal);

    return result;
}

/**
 * Calculate Buy X Get Y discount
 */
function calculateBuyXGetYDiscount(
    cartItems: CartItem[],
    buyQty: number,
    getQty: number,
    discountPercent: number
): { discount: number; sets: number } {
    let totalDiscount = 0;
    let totalSets = 0;

    for (const item of cartItems) {
        const sets = Math.floor(item.quantity / (buyQty + getQty));
        if (sets > 0) {
            const discountPerSet = getQty * item.price * (discountPercent / 100);
            totalDiscount += sets * discountPerSet;
            totalSets += sets;
        }
    }

    return { discount: totalDiscount, sets: totalSets };
}

/**
 * Find best promotion to apply from multiple promotions
 */
export function findBestPromotion(
    promotions: Promotion[],
    cartItems: CartItem[],
    subtotal: number,
    customerId?: string
): PromotionResult | null {
    const validResults: PromotionResult[] = [];

    for (const promotion of promotions) {
        const result = calculatePromotionDiscount(promotion, cartItems, subtotal, customerId);
        if (result.isValid) {
            validResults.push(result);
        }
    }

    if (validResults.length === 0) {
        return null;
    }

    // Return promotion with highest discount amount
    // If tied, prefer free shipping
    return validResults.reduce((best, current) => {
        if (current.discountAmount > best.discountAmount) {
            return current;
        }
        if (current.discountAmount === best.discountAmount && current.freeShipping && !best.freeShipping) {
            return current;
        }
        return best;
    });
}

/**
 * Validate promotion code
 */
export function validatePromotionCode(
    code: string,
    promotions: Promotion[]
): Promotion | null {
    // Note: 'now' reserved for future date validation
    // const now = new Date();

    const promotion = promotions.find(p =>
        p.code.toUpperCase() === code.toUpperCase()
    );

    if (!promotion) {
        return null;
    }

    // Additional validation could be added here
    // (check dates, usage limits, etc.)

    return promotion;
}
