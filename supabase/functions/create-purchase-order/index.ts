import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateCreatePurchaseOrder, type CreatePurchaseOrderInput } from './validation.ts';

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
    const { tenant_id, supplier_id, items, delivery_date, notes }: CreatePurchaseOrderInput = validateCreatePurchaseOrder(rawBody);

    // Get supplier info
    const { data: supplier } = await supabaseClient
      .from('suppliers')
      .select('*')
      .eq('id', supplier_id)
      .single();

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
        .single();

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

    // Create purchase order
    const { data: po, error: poError } = await supabaseClient
      .from('purchase_orders')
      .insert({
        tenant_id,
        supplier_id,
        total_amount: totalAmount,
        expected_delivery_date: delivery_date,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (poError) throw poError;

    // Create PO items
    const poItems = processedItems.map(item => ({
      ...item,
      purchase_order_id: po.id
    }));

    const { error: itemsError } = await supabaseClient
      .from('purchase_order_items')
      .insert(poItems);

    if (itemsError) throw itemsError;

    // TODO: Generate PDF and upload to storage
    // TODO: Send email to supplier

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
});
