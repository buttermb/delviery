import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateCreatePurchaseOrder, type CreatePurchaseOrderInput } from './validation.ts';
import { generatePurchaseOrderHtml } from './pdf.ts';
import { sendSupplierEmail } from './email.ts';

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

    // Fetch tenant info for branding
    const { data: tenantInfo } = await supabaseClient
      .from('tenants')
      .select('business_name, phone, owner_email')
      .eq('id', tenant_id)
      .maybeSingle();

    const businessName = (tenantInfo?.business_name as string) || 'Purchase Order';

    // Generate PDF (HTML document) and upload to storage
    let pdfUrl: string | null = null;
    try {
      const poNumber = po.po_number as string;
      const html = generatePurchaseOrderHtml({
        poNumber,
        businessName,
        supplierName: (supplier.name ?? supplier.supplier_name ?? 'Supplier') as string,
        supplierContact: (supplier.contact_person ?? '') as string,
        supplierAddress: (supplier.address ?? '') as string,
        items: processedItems,
        totalAmount,
        deliveryDate: delivery_date,
        notes,
        createdAt: new Date().toISOString(),
      });

      // Use service role client for storage operations
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Ensure bucket exists (idempotent)
      await serviceClient.storage.createBucket('purchase-orders', {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
      });

      const filePath = `${tenant_id}/${poNumber}.html`;
      const { error: uploadError } = await serviceClient.storage
        .from('purchase-orders')
        .upload(filePath, new Blob([html], { type: 'text/html' }), {
          contentType: 'text/html',
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = serviceClient.storage
          .from('purchase-orders')
          .getPublicUrl(filePath);
        pdfUrl = urlData?.publicUrl ?? null;

        // Store reference on the PO record
        await supabaseClient
          .from('purchase_orders')
          .update({ pdf_url: pdfUrl })
          .eq('id', po.id as string);
      } else {
        console.error('PDF upload failed:', uploadError.message);
      }
    } catch (pdfError) {
      // Non-fatal: PO is still created successfully
      console.error('PDF generation error:', pdfError);
    }

    // Send email notification to supplier
    let emailSent = false;
    try {
      emailSent = await sendSupplierEmail({
        supplierEmail: (supplier.email ?? '') as string,
        supplierName: (supplier.name ?? supplier.supplier_name ?? 'Supplier') as string,
        poNumber: po.po_number as string,
        businessName,
        items: processedItems,
        totalAmount,
        deliveryDate: delivery_date,
        notes,
        pdfUrl,
      });
    } catch (emailError) {
      // Non-fatal: PO is still created successfully
      console.error('Supplier email error:', emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        purchase_order_id: po.id,
        po_number: po.po_number,
        total_amount: totalAmount,
        pdf_url: pdfUrl,
        email_sent: emailSent,
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
