import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const portabilitySchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

serve(
  withZenProtection(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

      // Parse request
      const body = await req.json().catch(() => ({}));
      const { user_id, email, format } = portabilitySchema.parse(body);

      const targetUserId = user_id || user.id;

      // Collect portable data (machine-readable format)
      const portableData = {
        user: {
          id: targetUserId,
          email: user.email,
          created_at: user.created_at,
        },
        profile: null,
        orders: [],
        addresses: [],
      };

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();
      portableData.profile = profile;

      // Get orders (simplified)
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });
      portableData.orders = orders || [];

      // Get addresses
      const { data: addresses } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', targetUserId);
      portableData.addresses = addresses || [];

      // Convert to requested format
      let responseBody: string;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        // Convert to CSV (simplified)
        const csvRows: string[] = [];
        csvRows.push('Type,ID,Data');
        csvRows.push(`User,${portableData.user.id},"${JSON.stringify(portableData.user).replace(/"/g, '""')}"`);
        if (portableData.profile) {
          csvRows.push(`Profile,${portableData.profile.id},"${JSON.stringify(portableData.profile).replace(/"/g, '""')}"`);
        }
        portableData.orders.forEach((order: any) => {
          csvRows.push(`Order,${order.id},"${JSON.stringify(order).replace(/"/g, '""')}"`);
        });
        portableData.addresses.forEach((addr: any) => {
          csvRows.push(`Address,${addr.id},"${JSON.stringify(addr).replace(/"/g, '""')}"`);
        });
        responseBody = csvRows.join('\n');
        contentType = 'text/csv';
        filename = `gdpr-portable-${targetUserId}-${Date.now()}.csv`;
      } else {
        responseBody = JSON.stringify(portableData, null, 2);
        contentType = 'application/json';
        filename = `gdpr-portable-${targetUserId}-${Date.now()}.json`;
      }

      // Log export request
      await supabase.from('activity_logs').insert({
        user_id: targetUserId,
        tenant_id: null,
        action: 'gdpr_data_portability',
        resource: 'user',
        resource_id: targetUserId,
        metadata: {
          exported_by: user.id,
          export_date: new Date().toISOString(),
          format,
        },
        created_at: new Date().toISOString(),
      });

      return new Response(responseBody, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error('GDPR portability error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to export data',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

