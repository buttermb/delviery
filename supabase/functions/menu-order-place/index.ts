import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processPayment, refundPayment } from "../_shared/payment.ts";
import { validateMenuOrderPlace, type MenuOrderPlaceInput } from './validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trace-id, x-idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = req.headers.get('x-trace-id') || crypto.randomUUID();
  const idempotencyKey = req.headers.get('x-idempotency-key');

  console.log(`[ORDER_CREATE] Order placement started`, { traceId, idempotencyKey });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.json();
    const body: MenuOrderPlaceInput = validateMenuOrderPlace(rawBody);
    const {
      menu_id,
      order_items,
      payment_method,
      contact_phone,
    } = body;

    console.log(`[ORDER_CREATE] Request validated`, {
      traceId,
      menuId: menu_id,
      itemCount: order_items?.length,
      totalAmount: body.total_amount,
      paymentMethod: payment_method
    });

    // 1. RESERVE INVENTORY (Atomic RPC)
    const { data: reservation, error: reserveError } = await supabaseClient
      .rpc('reserve_inventory', {
        p_menu_id: menu_id,
        p_items: order_items,
        p_trace_id: traceId
      });

    if (reserveError) {
      console.error(`[ORDER_CREATE] Inventory reservation failed`, {
        traceId,
        menuId: menu_id,
        error: reserveError.message
      });
      return new Response(
        JSON.stringify({ error: reserveError.message || 'Inventory reservation failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { reservation_id, lock_token } = reservation;
    console.log(`[ORDER_CREATE] Inventory reserved`, { traceId, reservationId: reservation_id });

    // 2. PROCESS PAYMENT
    // SECURITY: Calculate total from DATABASE prices - NEVER trust client-provided total
    const productIds = order_items.map((item: { product_id: string }) => item.product_id);

    // FIX: Query disposable_menu_products (was disposable_menu_items) with products join
    const { data: menuItems, error: menuItemsError } = await supabaseClient
      .from('disposable_menu_products')
      .select('product_id, custom_price, prices, products(price)')
      .eq('menu_id', menu_id)
      .in('product_id', productIds);

    if (menuItemsError || !menuItems || menuItems.length === 0) {
      console.error(`[ORDER_CREATE] Failed to fetch menu item prices`, { traceId, error: menuItemsError });
      await supabaseClient.rpc('cancel_reservation', {
        p_reservation_id: reservation_id,
        p_reason: 'price_lookup_failed'
      });
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve product prices' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build price lookup: supports both flat pricing and tiered pricing
    type TieredPrice = { label: string; price: number; weight_grams?: number; max_qty?: number; note?: string };
    const priceMap = new Map<string, { flat_price: number; tiers: TieredPrice[] | null }>();

    for (const item of menuItems) {
      const productData = item.products as { price: number } | null;
      const flatPrice = item.custom_price != null ? Number(item.custom_price) : (productData?.price != null ? Number(productData.price) : 0);
      const tiers = (Array.isArray(item.prices) ? item.prices : null) as TieredPrice[] | null;
      priceMap.set(item.product_id, { flat_price: flatPrice, tiers });
    }

    // Calculate total from SERVER prices, supporting tiered pricing
    let totalAmount = 0;
    for (const item of order_items) {
      const priceInfo = priceMap.get(item.product_id);
      if (!priceInfo) {
        console.error(`[ORDER_CREATE] Product not found in menu`, { traceId, productId: item.product_id });
        await supabaseClient.rpc('cancel_reservation', {
          p_reservation_id: reservation_id,
          p_reason: 'product_not_in_menu'
        });
        return new Response(
          JSON.stringify({ error: `Product ${item.product_id} not available in this menu` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let unitPrice = priceInfo.flat_price;

      // If order item specifies a tier, look up the tier price
      if (item.tier_label && priceInfo.tiers) {
        const tier = priceInfo.tiers.find((t: TieredPrice) => t.label === item.tier_label);
        if (tier) {
          unitPrice = tier.price;
          // Enforce max_qty if set
          if (tier.max_qty && item.quantity > tier.max_qty) {
            await supabaseClient.rpc('cancel_reservation', {
              p_reservation_id: reservation_id,
              p_reason: 'exceeds_tier_max_qty'
            });
            return new Response(
              JSON.stringify({ error: `Maximum quantity for ${item.tier_label} is ${tier.max_qty}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }

      totalAmount += unitPrice * item.quantity;
    }

    console.log(`[ORDER_CREATE] Server-calculated total: ${totalAmount}`, { traceId });

    const paymentResult = await processPayment(totalAmount, payment_method, {
      reservation_id,
      trace_id: traceId
    });

    if (!paymentResult.success) {
      console.error(`[ORDER_CREATE] Payment failed`, {
        traceId,
        reservationId: reservation_id,
        error: paymentResult.error
      });
      await supabaseClient.rpc('cancel_reservation', {
        p_reservation_id: reservation_id,
        p_reason: 'payment_failed'
      });

      return new Response(
        JSON.stringify({ error: 'Payment failed', details: paymentResult.error }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ORDER_CREATE] Payment processed`, {
      traceId,
      transactionId: paymentResult.transaction_id
    });

    // 3. GET MENU TENANT INFO
    const { data: menuData } = await supabaseClient
      .from('disposable_menus')
      .select('tenant_id')
      .eq('id', menu_id)
      .maybeSingle();

    // 4. CONFIRM ORDER (Atomic RPC)
    const { data: order, error: confirmError } = await supabaseClient
      .rpc('confirm_menu_order', {
        p_reservation_id: reservation_id,
        p_order_data: { ...body, total_amount: totalAmount },
        p_payment_info: paymentResult,
        p_trace_id: traceId
      });

    if (confirmError) {
      console.error(`[ORDER_CREATE] Order confirmation failed - ZOMBIE RECOVERY`, {
        traceId,
        reservationId: reservation_id,
        error: confirmError.message
      });
      if (paymentResult.transaction_id) {
        try {
          await refundPayment(
            paymentResult.transaction_id,
            'system_error_order_creation_failed'
          );
          console.log(`[ORDER_CREATE] Refund processed`, { traceId, transactionId: paymentResult.transaction_id });
        } catch (refundError) {
          console.error(`[ORDER_CREATE] FATAL: Refund failed for Zombie Order! Manual intervention required.`, {
            traceId,
            transactionId: paymentResult.transaction_id,
            error: refundError
          });
        }
      }

      await supabaseClient.rpc('cancel_reservation', {
        p_reservation_id: reservation_id,
        p_reason: 'system_error'
      });

      return new Response(
        JSON.stringify({
          error: 'Order processing failed. Payment has been refunded.',
          trace_id: traceId,
          code: 'ZOMBIE_ORDER_RECOVERED'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ORDER_CREATE] Order confirmed successfully`, {
      traceId,
      orderId: order.order_id,
      menuId: menu_id,
      totalAmount
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.order_id,
        status: 'confirmed',
        trace_id: traceId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[ORDER_CREATE] Internal server error`, { traceId, error });
    return new Response(
      JSON.stringify({ error: 'Internal server error', trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
