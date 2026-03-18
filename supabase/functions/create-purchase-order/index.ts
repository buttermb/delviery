import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateCreatePurchaseOrder, type CreatePurchaseOrderInput } from './validation.ts';
import { sendEmail } from '../_shared/email.ts';

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
    const { tenant_id, supplier_id, items, delivery_date, notes }: CreatePurchaseOrderInput = validateCreatePurchaseOrder(rawBody);

    // Verify tenant ownership
    const { data: tenantUser } = await supabaseClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id || tenantUser.tenant_id !== tenant_id) {
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
      .eq('tenant_id', tenant_id)
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
        .eq('tenant_id', tenant_id)
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
          tenant_id,
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

    // Generate PO summary and upload to storage
    const poSummaryRows = processedItems.map(item =>
      `${item.product_name},${item.quantity_lbs},${item.price_per_lb},${item.subtotal}`
    );
    const csvContent = [
      `Purchase Order: ${po.po_number}`,
      `Supplier: ${supplier.name || supplier_id}`,
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      '',
      'Product,Quantity (lbs),Price/lb,Subtotal',
      ...poSummaryRows,
      '',
      `Total,,,${totalAmount}`,
    ].join('\n');

    const fileName = `purchase-orders/${tenant_id}/${po.po_number}.csv`;
    await supabaseClient.storage
      .from('exports')
      .upload(fileName, new Blob([csvContent], { type: 'text/csv' }), { upsert: true });

    // Send email to supplier
    if (supplier.email) {
      const itemsHtml = processedItems.map(item =>
        `<tr><td>${item.product_name}</td><td>${item.quantity_lbs} lbs</td><td>$${item.price_per_lb.toFixed(2)}</td><td>$${item.subtotal.toFixed(2)}</td></tr>`
      ).join('');

      await sendEmail({
        to: supplier.email,
        subject: `New Purchase Order - ${po.po_number}`,
        html: `<h2>Purchase Order ${po.po_number}</h2>
          ${delivery_date ? `<p><strong>Expected Delivery:</strong> ${delivery_date}</p>` : ''}
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <thead><tr><th>Product</th><th>Quantity</th><th>Price/lb</th><th>Subtotal</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>$${totalAmount.toFixed(2)}</strong></td></tr></tfoot>
          </table>`,
      }).catch((err) => console.error(`Failed to email PO to supplier:`, err));
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
});
