import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CreateOrderSchema = z.object({
  buyer_tenant_id: z.string().uuid(),
  buyer_user_id: z.string().uuid().optional(),
  seller_tenant_id: z.string().uuid(),
  seller_profile_id: z.string().uuid(),
  items: z.array(z.object({
    listing_id: z.string().uuid().optional(),
    product_name: z.string(),
    product_type: z.string().optional(),
    quantity: z.number().positive(),
    unit_price: z.number().positive(),
    total_price: z.number().positive(),
  })).min(1),
  shipping_address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default('USA'),
  }),
  shipping_method: z.string().optional(),
  shipping_cost: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  payment_terms: z.enum(['prepaid', 'net_30', 'net_60']).default('prepaid'),
  buyer_notes: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse and validate request body
    const rawBody = await req.json();
    const body = CreateOrderSchema.parse(rawBody);

    // Calculate subtotal from items
    const subtotal = body.items.reduce((sum, item) => sum + item.total_price, 0);

    // Calculate platform fee (2% of subtotal)
    const platformFee = Math.round((subtotal * 0.02) * 100) / 100;

    // Calculate total
    const totalAmount = subtotal + platformFee + body.tax + body.shipping_cost;

    // Generate order number
    const orderNumber = `WH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('marketplace_orders')
      .insert({
        order_number: orderNumber,
        buyer_tenant_id: body.buyer_tenant_id,
        buyer_user_id: body.buyer_user_id || null,
        seller_tenant_id: body.seller_tenant_id,
        seller_profile_id: body.seller_profile_id,
        status: 'pending',
        subtotal,
        platform_fee: platformFee,
        tax: body.tax,
        shipping_cost: body.shipping_cost,
        total_amount: totalAmount,
        payment_terms: body.payment_terms,
        payment_status: 'pending',
        shipping_address: body.shipping_address,
        shipping_method: body.shipping_method || null,
        buyer_notes: body.buyer_notes || null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = body.items.map((item) => ({
      order_id: order.id,
      listing_id: item.listing_id || null,
      product_name: item.product_name,
      product_type: item.product_type || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    const { error: itemsError } = await supabase
      .from('marketplace_order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Create platform transaction record
    const { error: transactionError } = await supabase
      .from('platform_transactions')
      .insert({
        tenant_id: body.seller_tenant_id, // Fee is charged to seller
        order_id: order.id,
        transaction_type: 'platform_fee',
        amount: platformFee,
        fee_percentage: 2.00,
        status: 'pending', // Will be collected when order is paid
        description: `Platform fee for order ${orderNumber}`,
        metadata: {
          order_number: orderNumber,
          subtotal,
          buyer_tenant_id: body.buyer_tenant_id,
        },
      });

    if (transactionError) {
      // Log but don't fail - transaction record is for tracking
      console.warn('Failed to create platform transaction record (non-blocking)', transactionError);
    }

    // Update listing quantities (if listing_id provided)
    for (const item of body.items) {
      if (item.listing_id) {
        const { error: updateError } = await supabase.rpc('decrement_listing_quantity', {
          p_listing_id: item.listing_id,
          p_quantity: item.quantity,
        });

        if (updateError) {
          console.warn(`Failed to update listing quantity for ${item.listing_id} (non-blocking)`, updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order,
        orderItems,
        feeBreakdown: {
          subtotal,
          platformFee,
          tax: body.tax,
          shippingCost: body.shipping_cost,
          totalAmount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in create-marketplace-order:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

