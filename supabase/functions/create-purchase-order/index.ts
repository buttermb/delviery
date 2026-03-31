import { createClient, corsHeaders } from '../_shared/deps.ts';
import { validateCreatePurchaseOrder, type CreatePurchaseOrderInput } from './validation.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(req, CREDIT_ACTIONS.CREATE_PURCHASE_ORDER, async (tenantId, serviceClient) => {
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      );

      const rawBody = await req.json();
      const { tenant_id, supplier_id, items, delivery_date, notes }: CreatePurchaseOrderInput = validateCreatePurchaseOrder(rawBody);

      // Verify the tenant from credit gate matches the request
      if (tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ error: 'Not authorized for this tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get supplier info
      const { data: supplier } = await supabaseClient
        .from('suppliers')
        .select('*')
        .eq('id', supplier_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (!supplier) {
        return new Response(
          JSON.stringify({ error: 'Supplier not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate order total
      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const { data: product } = await supabaseClient
          .from('products')
          .select('wholesale_price_per_lb')
          .eq('id', item.product_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        const itemTotal = item.quantity_lbs * (product?.wholesale_price_per_lb || item.price_per_lb);
        totalAmount += itemTotal;

        processedItems.push({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity_lbs: item.quantity_lbs,
          quantity_units: item.quantity_units || 0,
          price_per_lb: product?.wholesale_price_per_lb || item.price_per_lb,
          subtotal: itemTotal
        });
      }

      // Check minimum order amount
      if (supplier.minimum_order_amount && totalAmount < supplier.minimum_order_amount) {
        return new Response(
          JSON.stringify({
            error: 'Order total below minimum',
            minimum: supplier.minimum_order_amount,
            current: totalAmount
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create purchase order with retry on PO number collision
      // The DB trigger generates po_number via generate_po_number() which uses
      // random hex suffix. The column has a UNIQUE constraint, so concurrent
      // inserts could collide. Retry up to 3 times with a fresh generated number.
      const MAX_PO_RETRIES = 3;
      let po: Record<string, unknown> | null = null;

      for (let attempt = 0; attempt < MAX_PO_RETRIES; attempt++) {
        const { data: poData, error: poError } = await supabaseClient
          .from('purchase_orders')
          .insert({
            tenant_id: tenantId,
            supplier_id,
            total_amount: totalAmount,
            expected_delivery_date: delivery_date,
            notes,
            status: 'pending'
          })
          .select()
          .single();

        if (!poError) {
          po = poData;
          break;
        }

        // Retry only on unique constraint violation (code 23505)
        const isUniqueViolation = poError.code === '23505' || poError.message?.includes('duplicate key');
        if (!isUniqueViolation || attempt === MAX_PO_RETRIES - 1) {
          throw poError;
        }
        // Brief pause before retry to allow clock/random state to change
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      }

      if (!po) throw new Error('Failed to create purchase order after retries');

      // Create PO items
      const poItems = processedItems.map(item => ({
        ...item,
        purchase_order_id: po.id
      }));

      const { error: itemsError } = await supabaseClient
        .from('purchase_order_items')
        .insert(poItems);

      if (itemsError) {
        // Rollback: delete the orphaned PO header
        await supabaseClient.from('purchase_orders').delete().eq('id', po.id as string);
        throw itemsError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          purchase_order_id: po.id,
          po_number: po.po_number,
          total_amount: totalAmount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }); // End of withCreditGate
});
