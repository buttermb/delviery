import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const portalDataSchema = z.object({
  portal_token: z.string().uuid(),
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

      // Parse and validate request body
      const body = await req.json();
      const { portal_token } = portalDataSchema.parse(body);

      // 1. Fetch client by portal_token (will fail if invalid)
      const { data: client, error: clientError } = await supabase
        .from('wholesale_clients')
        .select('id, tenant_id, business_name, contact_name, email, phone, portal_token, created_at')
        .eq('portal_token', portal_token)
        .maybeSingle();

      if (clientError) {
        return new Response(
          JSON.stringify({ error: 'Database error' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (!client) {
        return new Response(
          JSON.stringify({ error: 'Invalid portal access' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Optional: Check portal token expiry (if column exists)
      // if (client.portal_token_expires_at && new Date() > new Date(client.portal_token_expires_at)) {
      //   return new Response(
      //     JSON.stringify({ error: 'Portal link expired' }),
      //     { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      //   );
      // }

      const tenantId = client.tenant_id;

      // 2. Fetch invoices (ONLY for this client, tenant-isolated)
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', client.id)
        .eq('tenant_id', tenantId)
        .order('issue_date', { ascending: false });

      if (invoicesError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch invoices' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 3. Fetch orders (ONLY for this client, tenant-isolated)
      const { data: orders, error: ordersError } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (ordersError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch orders' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // 4. Calculate statistics
      const statistics = {
        total_invoices: invoices?.length || 0,
        total_spent: invoices?.reduce((sum, inv) => sum + Number(inv.total || 0), 0) || 0,
        pending_invoices: invoices?.filter(inv => inv.status === 'sent' || inv.status === 'draft').length || 0,
        total_orders: orders?.length || 0,
      };

      // 5. Return combined data
      return new Response(
        JSON.stringify({
          client: {
            id: client.id,
            business_name: client.business_name,
            contact_name: client.contact_name,
            email: client.email,
            phone: client.phone,
            portal_token: client.portal_token,
            created_at: client.created_at || new Date().toISOString(),
          },
          invoices: (invoices || []).map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            total: Number(inv.total || 0),
            subtotal: Number(inv.subtotal || 0),
            tax: Number(inv.tax || 0),
            status: inv.status || 'draft',
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            line_items: inv.line_items || [],
            created_at: inv.created_at,
          })),
          orders: (orders || []).map(order => ({
            id: order.id,
            created_at: order.created_at,
            total_amount: Number(order.total_amount || 0),
            status: order.status || 'pending',
            items: order.order_data?.items || [],
            delivery_method: order.delivery_method,
            payment_method: order.payment_method,
            converted_to_invoice_id: order.converted_to_invoice_id,
          })),
          statistics,
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

