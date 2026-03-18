/**
 * Credits Apply Promo
 *
 * Validates a promo code for a credit package purchase and returns the
 * calculated discount without applying it. Supports percentage, fixed_credits,
 * and multiplier discount types.
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const RequestSchema = z.object({
  promo_code: z.string().min(1).max(50),
  package_id: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const { promo_code, package_id } = RequestSchema.parse(body);

    // Fetch the credit package
    const { data: creditPackage, error: packageError } = await supabase
      .from('credit_packages')
      .select('id, name, slug, credits, price_cents, is_active')
      .eq('id', package_id)
      .eq('is_active', true)
      .maybeSingle();

    if (packageError || !creditPackage) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive credit package' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the promo code (case-insensitive match)
    const { data: promotion, error: promoError } = await supabase
      .from('credit_promotions')
      .select('*')
      .ilike('code', promo_code)
      .eq('is_active', true)
      .maybeSingle();

    if (promoError || !promotion) {
      return new Response(
        JSON.stringify({ error: 'Invalid promo code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date range
    const now = new Date();
    const validFrom = new Date(promotion.valid_from);
    const validUntil = new Date(promotion.valid_until);

    if (now < validFrom) {
      return new Response(
        JSON.stringify({ error: 'Promo code is not yet active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (now > validUntil) {
      return new Response(
        JSON.stringify({ error: 'Promo code has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check global usage limit
    if (promotion.usage_limit !== null && promotion.usage_count >= promotion.usage_limit) {
      return new Response(
        JSON.stringify({ error: 'Promo code has reached its usage limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check per-user usage limit
    if (promotion.per_user_limit !== null) {
      const { count, error: usageError } = await supabase
        .from('credit_promotion_usage')
        .select('*', { count: 'exact', head: true })
        .eq('promotion_id', promotion.id)
        .eq('user_id', user.id);

      if (usageError) {
        return new Response(
          JSON.stringify({ error: 'Failed to check promotion usage' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if ((count ?? 0) >= promotion.per_user_limit) {
        return new Response(
          JSON.stringify({ error: 'You have already used this promo code the maximum number of times' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check minimum purchase credits requirement
    if (promotion.min_purchase_credits !== null && creditPackage.credits < promotion.min_purchase_credits) {
      return new Response(
        JSON.stringify({
          error: `This promo code requires a minimum package of ${promotion.min_purchase_credits} credits`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate discount based on type
    const originalPriceCents = creditPackage.price_cents;
    let discountCents = 0;

    switch (promotion.type) {
      case 'percentage': {
        // value represents percentage (e.g., 20 = 20% off)
        discountCents = Math.floor(originalPriceCents * (promotion.value / 100));
        break;
      }
      case 'fixed_credits': {
        // value represents a fixed amount in cents to discount
        discountCents = promotion.value;
        break;
      }
      case 'multiplier': {
        // value represents the multiplier for credits (e.g., 2 = 2x credits)
        // Discount is the effective savings: price stays same but you get more credits
        // represented as 0 discount on price since multiplier gives bonus credits
        discountCents = 0;
        break;
      }
      default: {
        return new Response(
          JSON.stringify({ error: 'Unknown promotion type' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Apply max discount cap if set
    if (promotion.max_discount_credits !== null && discountCents > promotion.max_discount_credits) {
      discountCents = promotion.max_discount_credits;
    }

    // Ensure discount doesn't exceed the original price
    if (discountCents > originalPriceCents) {
      discountCents = originalPriceCents;
    }

    const finalPriceCents = originalPriceCents - discountCents;

    // Calculate effective credits (for multiplier type)
    const effectiveCredits = promotion.type === 'multiplier'
      ? creditPackage.credits * promotion.value
      : creditPackage.credits;

    return new Response(
      JSON.stringify({
        success: true,
        promo_code: promotion.code,
        promotion_id: promotion.id,
        promotion_type: promotion.type,
        package: {
          id: creditPackage.id,
          name: creditPackage.name,
          credits: creditPackage.credits,
          original_price_cents: originalPriceCents,
        },
        discount: {
          type: promotion.type,
          value: promotion.value,
          discount_cents: discountCents,
          final_price_cents: finalPriceCents,
          effective_credits: effectiveCredits,
          savings_description: getSavingsDescription(promotion.type, promotion.value, discountCents, effectiveCredits, creditPackage.credits),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getSavingsDescription(
  type: string,
  value: number,
  discountCents: number,
  effectiveCredits: number,
  baseCredits: number
): string {
  switch (type) {
    case 'percentage':
      return `${value}% off ($${(discountCents / 100).toFixed(2)} savings)`;
    case 'fixed_credits':
      return `$${(discountCents / 100).toFixed(2)} off`;
    case 'multiplier':
      return `${value}x credits (${effectiveCredits.toLocaleString()} credits instead of ${baseCredits.toLocaleString()})`;
    default:
      return '';
  }
}
