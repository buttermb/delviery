import { supabase } from '@/integrations/supabase/client';

export interface CouponValidationResult {
  valid: boolean;
  discount: number;
  discountType: 'percentage' | 'fixed';
  message?: string;
  maxDiscount?: number;
}

export async function validateCoupon(
  code: string,
  userId: string | null,
  cartTotal: number
): Promise<CouponValidationResult> {
  try {
    // Fetch coupon
    const { data: coupon, error } = await supabase
      .from('coupon_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single();

    if (error || !coupon) {
      return { valid: false, discount: 0, discountType: 'percentage', message: 'Invalid coupon code' };
    }

    // Check if expired
    if (!coupon.never_expires && coupon.end_date && new Date(coupon.end_date) < new Date()) {
      return { valid: false, discount: 0, discountType: 'percentage', message: 'Coupon has expired' };
    }

    // Check start date
    if (coupon.start_date && new Date(coupon.start_date) > new Date()) {
      return { valid: false, discount: 0, discountType: 'percentage', message: 'Coupon not yet active' };
    }

    // Check minimum purchase
    if (cartTotal < coupon.min_purchase) {
      return {
        valid: false,
        discount: 0,
        discountType: 'percentage',
        message: `Minimum purchase of $${coupon.min_purchase} required`
      };
    }

    // Check total usage limit
    if (coupon.total_usage_limit && coupon.used_count >= coupon.total_usage_limit) {
      return { valid: false, discount: 0, discountType: 'percentage', message: 'Coupon usage limit reached' };
    }

    // Check per-user limit (if user is authenticated)
    if (userId && coupon.per_user_limit) {
      const { data: usageData, error: usageError } = await supabase
        .from('coupon_usage')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('user_id', userId);

      if (!usageError && usageData && usageData.length >= coupon.per_user_limit) {
        return {
          valid: false,
          discount: 0,
          discountType: 'percentage',
          message: 'You have reached the usage limit for this coupon'
        };
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (cartTotal * coupon.discount_value) / 100;
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    } else {
      discount = coupon.discount_value;
    }

    return {
      valid: true,
      discount: Math.min(discount, cartTotal),
      discountType: coupon.discount_type as 'percentage' | 'fixed',
      maxDiscount: coupon.max_discount || undefined,
      message: 'Coupon applied successfully'
    };
  } catch (error) {
    console.error('Error validating coupon:', error);
    return { valid: false, discount: 0, discountType: 'percentage', message: 'Error validating coupon' };
  }
}

export async function applyCoupon(
  couponId: string,
  userId: string,
  orderId: string,
  discountAmount: number
) {
  try {
    // Record usage
    await supabase.from('coupon_usage').insert({
      coupon_id: couponId,
      user_id: userId,
      order_id: orderId,
      discount_amount: discountAmount
    });

    // Increment used count using RPC
    await supabase.rpc('increment_coupon_usage', { coupon_id: couponId });

    return { success: true };
  } catch (error) {
    console.error('Error applying coupon:', error);
    return { success: false, error };
  }
}

export async function getCouponByCode(code: string) {
  const { data, error } = await supabase
    .from('coupon_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'active')
    .single();

  if (error) return null;
  return data;
}