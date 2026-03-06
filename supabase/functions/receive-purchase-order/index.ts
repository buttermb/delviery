import { serve, createClient, corsHeaders } from '../_shared/deps.ts';

interface ReceiveItemRequest {
  item_id: string;
  quantity_received: number;
}

interface ReceivePORequest {
  purchase_order_id: string;
  items: ReceiveItemRequest[];
  received_date?: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Resolve tenant
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      throw new Error('Tenant not found');
    }

    const body: ReceivePORequest = await req.json();
    const { purchase_order_id, items, received_date, notes } = body;

    // Validation
    if (!purchase_order_id || !items || items.length === 0) {
      throw new Error('Purchase order ID and items are required');
    }

    // Verify PO exists and is in correct status
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('*, items:purchase_order_items(*)')
      .eq('id', purchase_order_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    if (poError || !po) {
      throw new Error('Purchase order not found');
    }

    if (po.status === 'received') {
      throw new Error('Purchase order already received');
    }

    if (po.status !== 'approved') {
      throw new Error('Purchase order must be approved before receiving');
    }

    // Process each received item
    for (const receivedItem of items) {
      if (receivedItem.quantity_received < 0) {
        throw new Error(`Invalid quantity for item ${receivedItem.item_id}: must be non-negative`);
      }

      // Find the corresponding PO item
      const poItem = po.items?.find((i: Record<string, unknown>) => i.id === receivedItem.item_id);
      if (!poItem) {
        console.error(`PO item ${receivedItem.item_id} not found`);
        continue;
      }

      // Update PO item with received quantity
      const { error: updateItemError } = await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: receivedItem.quantity_received,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receivedItem.item_id);

      if (updateItemError) {
        console.error('Failed to update PO item:', updateItemError);
        continue;
      }

      // Update product inventory - add received quantity to stock
      if (poItem.product_id) {
        // Atomic stock update
        const { error: stockError } = await supabase.rpc('increment_product_stock', {
          p_product_id: poItem.product_id,
          p_quantity: receivedItem.quantity_received,
        });

        if (stockError && stockError.code === 'PGRST202') {
          // Fallback: non-atomic update (legacy)
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', poItem.product_id)
            .maybeSingle();

          if (product) {
            const newStock = (product.stock_quantity || 0) + receivedItem.quantity_received;
            await supabase
              .from('products')
              .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
              .eq('id', poItem.product_id);
          }
        } else if (stockError) {
          console.error('Failed to update product stock:', stockError);
        }
      }
    }

    // Update PO status to received
    const { error: updatePOError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'received',
        received_date: received_date || new Date().toISOString().split('T')[0],
        notes: notes || po.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchase_order_id);

    if (updatePOError) {
      throw new Error('Failed to update purchase order status');
    }

    // Fetch updated PO
    const { data: updatedPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(id, name, contact_name),
        items:purchase_order_items(
          *,
          product:products(id, name, sku, stock_quantity)
        )
      `)
      .eq('id', purchase_order_id)
      .maybeSingle();

    if (fetchError || !updatedPO) {
      throw new Error('Purchase order received but failed to fetch details');
    }

    return new Response(
      JSON.stringify({
        success: true,
        purchase_order: updatedPO,
        message: 'Purchase order received successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Receive PO error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
