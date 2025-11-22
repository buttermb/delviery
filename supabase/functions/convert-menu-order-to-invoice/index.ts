import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const convertSchema = z.object({
  menu_order_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
});

serve(
  withZenProtection(async (req) => {
    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Validate environment variables
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Verify authentication
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const { menu_order_id, client_id: providedClientId } = convertSchema.parse(body);

      // 1. Check if already converted (prevent double conversion)
      const { data: order, error: orderError } = await supabase
        .from('menu_orders')
        .select('id, converted_to_invoice_id, tenant_id, order_data, total_amount, client_id, menu_id')
        .eq('id', menu_order_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (order.converted_to_invoice_id) {
        return new Response(
          JSON.stringify({ error: 'Order already converted to invoice' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 2. Get or validate client_id
      const clientId = providedClientId || order.client_id;

      if (!clientId) {
        return new Response(
          JSON.stringify({ error: 'Client ID required. Order is not linked to a client.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Verify client exists and belongs to same tenant
      const { data: client, error: clientError } = await supabase
        .from('wholesale_clients')
        .select('id, tenant_id')
        .eq('id', clientId)
        .eq('tenant_id', order.tenant_id)
        .maybeSingle();

      if (clientError || !client) {
        return new Response(
          JSON.stringify({ error: 'Invalid client or client does not belong to this tenant' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 3. Map order_data to invoice line items
      const orderData = order.order_data || {};
      const items = orderData.items || [];
      
      const lineItems = items.map((item: any) => ({
        product_name: item.name || item.product_name || 'Unknown Product',
        quantity: Number(item.quantity || 1),
        price: Number(item.price || item.unit_price || 0),
        total: Number(item.quantity || 1) * Number(item.price || item.unit_price || 0),
      }));

      const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const tax = Number(orderData.tax || 0);
      const total = subtotal + tax;

      // 4. Generate invoice number (timestamp-based for now)
      const invoiceNumber = `INV-${Date.now()}`;

      // 5. Create invoice with locked prices
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          tenant_id: order.tenant_id,
          client_id: clientId,
          invoice_number: invoiceNumber,
          total: total,
          subtotal: subtotal,
          tax: tax,
          amount_due: total,
          status: 'draft', // Admin can update to 'sent' later
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
          line_items: lineItems,
        })
        .select()
        .single();

      if (invoiceError || !invoice) {
        return new Response(
          JSON.stringify({ error: 'Failed to create invoice', details: invoiceError?.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 6. Update menu_orders with conversion tracking
      const { error: updateError } = await supabase
        .from('menu_orders')
        .update({
          converted_to_invoice_id: invoice.id,
          converted_at: new Date().toISOString(),
        })
        .eq('id', menu_order_id);

      if (updateError) {
        // Invoice created but tracking update failed - log but don't fail
        // Could implement rollback here if needed
        return new Response(
          JSON.stringify({ 
            error: 'Invoice created but failed to update order tracking',
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 7. Return success
      return new Response(
        JSON.stringify({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          success: true,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({ error: 'Invalid request format', details: error.errors }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Handle other errors
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  })
);

