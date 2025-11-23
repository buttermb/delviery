import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateProcessReturn, type ProcessReturnInput } from './validation.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const rawBody = await req.json();
    const { tenant_id, customer_id, order_id, items, reason, notes }: ProcessReturnInput = validateProcessReturn(rawBody);

    // Calculate return total
    let totalAmount = 0;
    let refundAmount = 0;
    const restockingFee = 0; // Can be calculated based on business rules

    for (const item of items) {
      totalAmount += item.subtotal;
    }

    refundAmount = totalAmount - restockingFee;

    // Create return authorization
    const { data: ra, error: raError } = await supabaseClient
      .from('return_authorizations')
      .insert({
        tenant_id,
        customer_id,
        order_id,
        reason,
        notes,
        total_amount: totalAmount,
        refund_amount: refundAmount,
        restocking_fee: restockingFee,
        status: 'pending'
      })
      .select()
      .single();

    if (raError) throw raError;

    // Create return items
    const returnItems = items.map((item: any) => ({
      return_authorization_id: ra.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity_lbs: item.quantity_lbs,
      quantity_units: item.quantity_units || 0,
      price_per_lb: item.price_per_lb,
      subtotal: item.subtotal,
      reason: item.reason,
      condition: item.condition || 'unopened',
      disposition: item.disposition || 'restock'
    }));

    const { error: itemsError } = await supabaseClient
      .from('return_items')
      .insert(returnItems);

    if (itemsError) throw itemsError;

    // If approved, restore inventory
    if (ra.status === 'approved') {
      for (const item of items) {
        if (item.disposition === 'restock') {
          await supabaseClient.rpc('increment_wholesale_inventory', {
            p_product_id: item.product_id,
            p_quantity: item.quantity_lbs
          });
        }
      }

      // Update customer balance (reduce outstanding balance)
      const { data: client } = await supabaseClient
        .from('wholesale_clients')
        .select('outstanding_balance')
        .eq('id', customer_id)
        .single();

      if (client) {
        await supabaseClient
          .from('wholesale_clients')
          .update({ 
            outstanding_balance: Math.max(0, client.outstanding_balance - refundAmount)
          })
          .eq('id', customer_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        return_authorization_id: ra.id,
        ra_number: ra.ra_number,
        refund_amount: refundAmount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
