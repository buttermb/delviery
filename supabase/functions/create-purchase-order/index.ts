import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateCreatePurchaseOrder } from './validation.ts';

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

    // Auth check
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.json();

    // Validate input — return 400 on schema errors
    let input;
    try {
      input = validateCreatePurchaseOrder(rawBody);
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Invalid request body';
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      supplier_id,
      items,
      notes,
      status: requestedStatus,
    } = input;

    // Normalize delivery date: accept both field names from different frontend callers
    const deliveryDate = input.expected_delivery_date || input.delivery_date;

    // Resolve tenant_id: prefer auth-based lookup, fall back to body if provided
    const { data: tenantUser } = await supabaseClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for any tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    // If tenant_id was provided in body, verify it matches
    if (input.tenant_id && input.tenant_id !== tenantId) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get vendor info (table is "vendors", not "suppliers")
    const { data: vendor } = await supabaseClient
      .from('vendors')
      .select('id, name, minimum_order_amount')
      .eq('id', supplier_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!vendor) {
      return new Response(
        JSON.stringify({ error: 'Vendor not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up product names and wholesale prices for items that need them
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const { data: product } = await supabaseClient
        .from('products')
        .select('name, wholesale_price_per_lb, cost_per_unit')
        .eq('id', item.product_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Resolve unit cost: prefer explicit value, fall back to DB wholesale/cost
      const unitCost = item.unit_cost
        ?? item.price_per_lb
        ?? product?.wholesale_price_per_lb
        ?? product?.cost_per_unit
        ?? 0;

      const productName = item.product_name || product?.name || 'Unknown Product';
      const quantity = Math.ceil(item.quantity_lbs);
      const totalCost = item.quantity_lbs * unitCost;
      subtotal += totalCost;

      processedItems.push({
        product_id: item.product_id,
        product_name: productName,
        quantity,
        unit_cost: unitCost,
        total_cost: totalCost,
      });
    }

    // Check minimum order amount
    if (vendor.minimum_order_amount && subtotal < vendor.minimum_order_amount) {
      return new Response(
        JSON.stringify({
          error: 'Order total below minimum',
          minimum: vendor.minimum_order_amount,
          current: subtotal,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create purchase order with retry on PO number collision.
    // The DB trigger generates po_number via generate_po_number() which uses
    // random hex suffix. The column has a UNIQUE constraint, so concurrent
    // inserts could collide. Retry up to 3 times.
    const MAX_PO_RETRIES = 3;
    let po: Record<string, unknown> | null = null;

    for (let attempt = 0; attempt < MAX_PO_RETRIES; attempt++) {
      const { data: poData, error: poError } = await supabaseClient
        .from('purchase_orders')
        .insert({
          tenant_id: tenantId,
          vendor_id: supplier_id,
          subtotal,
          total: subtotal,
          expected_delivery_date: deliveryDate || null,
          notes: notes || null,
          status: requestedStatus || 'pending',
          created_by: user.id,
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
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }

    if (!po) throw new Error('Failed to create purchase order after retries');

    // Create PO items
    const poItems = processedItems.map(item => ({
      ...item,
      purchase_order_id: po!.id as string,
    }));

    const { error: itemsError } = await supabaseClient
      .from('purchase_order_items')
      .insert(poItems);

    if (itemsError) {
      // Rollback: delete the orphaned PO header
      await supabaseClient.from('purchase_orders').delete().eq('id', po.id as string);
      throw itemsError;
    }

    // Return response in the shape the frontend expects:
    // { purchase_order: { id, po_number, vendor_id, total, items } }
    return new Response(
      JSON.stringify({
        success: true,
        purchase_order: {
          id: po.id,
          po_number: po.po_number,
          vendor_id: supplier_id,
          total: subtotal,
          status: po.status,
          items: processedItems,
        },
        // Keep flat fields for backward compat
        purchase_order_id: po.id,
        po_number: po.po_number,
        total_amount: subtotal,
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
