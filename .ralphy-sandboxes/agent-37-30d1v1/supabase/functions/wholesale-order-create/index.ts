// @ts-nocheck - Disable type checking for Deno/Supabase client compatibility
// Edge Function: wholesale-order-create (Security Hardened)
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateWholesaleOrderCreate } from './validation.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Wrap with credit gating for free tier users
  return withCreditGate(req, CREDIT_ACTIONS.CREATE_ORDER, async (creditTenantId, serviceClient) => {
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      );

      const rawBody = await req.json();
      const {
        client_id,
        items,
        delivery_address,
        delivery_notes,
        idempotency_key,
        tenant_id
      } = validateWholesaleOrderCreate(rawBody);

      // Get tenant_id from auth context if not provided
      const { data: { user } } = await supabaseClient.auth.getUser();
      let resolvedTenantId = tenant_id;

      if (!resolvedTenantId && user) {
        const { data: tenantUser } = await supabaseClient
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .maybeSingle();
        resolvedTenantId = tenantUser?.tenant_id;
      }

      if (!resolvedTenantId) {
        return new Response(
          JSON.stringify({ error: 'Tenant ID required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try atomic RPC first (preferred - single transaction, prevents race conditions)
      const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('create_wholesale_order_atomic', {
        p_tenant_id: resolvedTenantId,
        p_client_id: client_id,
        p_items: items.map((item: { inventory_id: string; quantity_lbs: number; price_per_lb?: number }) => ({
          inventory_id: item.inventory_id,
          quantity_lbs: item.quantity_lbs,
          price_per_lb: item.price_per_lb || null
        })),
        p_delivery_address: delivery_address || null,
        p_delivery_notes: delivery_notes || null,
        p_payment_method: 'credit',
        p_idempotency_key: idempotency_key || null
      });

      if (rpcError) {
        // If RPC doesn't exist, fall back to legacy method
        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('does not exist')) {
          console.log('[WHOLESALE_ORDER] Atomic RPC not available, using legacy method');
          return await handleLegacyOrderCreate(supabaseClient, client_id, items, delivery_address, delivery_notes);
        }

        // Handle specific business errors from RPC
        if (rpcError.message?.includes('Credit limit exceeded')) {
          return new Response(
            JSON.stringify({ error: rpcError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (rpcError.message?.includes('Insufficient inventory')) {
          return new Response(
            JSON.stringify({ error: rpcError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (rpcError.message?.includes('Client not found')) {
          return new Response(
            JSON.stringify({ error: 'Client not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        throw rpcError;
      }

      // RPC succeeded
      const result = rpcResult as {
        success: boolean;
        order_id: string;
        order_number: string;
        total_amount: number;
        new_client_balance: number;
        idempotent?: boolean;
      };

      return new Response(
        JSON.stringify({
          success: true,
          order_id: result.order_id,
          order_number: result.order_number,
          total_amount: result.total_amount,
          new_client_balance: result.new_client_balance,
          idempotent: result.idempotent || false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('[WHOLESALE_ORDER] Error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }); // End of withCreditGate
});

// Legacy order creation (fallback if atomic RPC not available)
async function handleLegacyOrderCreate(
  supabaseClient: ReturnType<typeof createClient>,
  client_id: string,
  items: Array<{ inventory_id: string; quantity_lbs: number }>,
  delivery_address?: string,
  delivery_notes?: string
) {
  // Get client info to check credit
  const { data: client } = await supabaseClient
    .from('wholesale_clients')
    .select('*, credit_limit, outstanding_balance')
    .eq('id', client_id)
    .single();

  if (!client) {
    return new Response(
      JSON.stringify({ error: 'Client not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate order total
  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const { data: inventory } = await supabaseClient
      .from('wholesale_inventory')
      .select('*, products(name, wholesale_price_per_lb)')
      .eq('id', item.inventory_id)
      .single();

    if (!inventory || inventory.quantity_lbs < item.quantity_lbs) {
      return new Response(
        JSON.stringify({ error: `Insufficient inventory for item ${item.inventory_id}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pricePerLb = inventory.products?.wholesale_price_per_lb || inventory.base_price || 0;
    const itemTotal = item.quantity_lbs * pricePerLb;
    totalAmount += itemTotal;

    processedItems.push({
      inventory_id: item.inventory_id,
      quantity_lbs: item.quantity_lbs,
      price_per_lb: pricePerLb,
      subtotal: itemTotal
    });
  }

  // Check credit limit
  const newBalance = (client.outstanding_balance || 0) + totalAmount;
  if (newBalance > (client.credit_limit || 0)) {
    return new Response(
      JSON.stringify({
        error: 'Credit limit exceeded',
        available_credit: (client.credit_limit || 0) - (client.outstanding_balance || 0),
        order_total: totalAmount
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create wholesale order
  const { data: order, error: orderError } = await supabaseClient
    .from('wholesale_orders')
    .insert({
      client_id,
      total_amount: totalAmount,
      delivery_address,
      delivery_notes,
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) throw orderError;

  // Create order items
  const orderItems = processedItems.map(item => ({
    ...item,
    order_id: order.id
  }));

  const { error: itemsError } = await supabaseClient
    .from('wholesale_order_items')
    .insert(orderItems);

  if (itemsError) throw itemsError;

  // Update inventory quantities
  for (const item of items) {
    await supabaseClient.rpc('decrement_wholesale_inventory', {
      p_inventory_id: item.inventory_id,
      p_quantity: item.quantity_lbs
    });
  }

  // Update client outstanding balance using atomic RPC if available
  const { error: balanceError } = await supabaseClient.rpc('adjust_client_balance', {
    p_client_id: client_id,
    p_amount: totalAmount,
    p_operation: 'add'
  });

  if (balanceError) {
    // Fallback to direct update
    await supabaseClient
      .from('wholesale_clients')
      .update({ outstanding_balance: newBalance })
      .eq('id', client_id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      total_amount: totalAmount,
      new_client_balance: newBalance
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
