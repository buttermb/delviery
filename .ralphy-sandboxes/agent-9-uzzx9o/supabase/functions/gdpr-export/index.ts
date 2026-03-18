import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const exportSchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
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
      const { user_id, email } = exportSchema.parse({
        user_id: body.user_id || user.id,
        email: body.email || user.email,
      });

      // Get user data
      const targetUserId = user_id || user.id;

      // Collect all user data
      interface UserData {
        profile: Record<string, unknown> | null;
        orders: Array<Record<string, unknown>>;
        order_items: Array<Record<string, unknown>>;
        addresses: Array<Record<string, unknown>>;
        payments: Array<Record<string, unknown>>;
        activity_logs: Array<Record<string, unknown>>;
        audit_logs: Array<Record<string, unknown>>;
        cart_items: Array<Record<string, unknown>>;
        reviews: Array<Record<string, unknown>>;
        notifications: Array<Record<string, unknown>>;
      }

      const userData: UserData = {
        profile: null,
        orders: [],
        order_items: [],
        addresses: [],
        payments: [],
        activity_logs: [],
        audit_logs: [],
        cart_items: [],
        reviews: [],
        notifications: [],
      };

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();
      userData.profile = profile;

      // Get orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', targetUserId);
      userData.orders = orders || [];

      // Get order items
      if (userData.orders.length > 0) {
        const orderIds = userData.orders
          .map((o) => typeof o === 'object' && o !== null && 'id' in o ? String(o.id) : null)
          .filter((id): id is string => id !== null);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        userData.order_items = orderItems || [];
      }

      // Get addresses
      const { data: addresses } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', targetUserId);
      userData.addresses = addresses || [];

      // Get payments
      const { data: payments } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', targetUserId);
      userData.payments = payments || [];

      // Get activity logs
      const { data: activityLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', targetUserId);
      userData.activity_logs = activityLogs || [];

      // Get audit logs (if accessible)
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('actor_id', targetUserId);
      userData.audit_logs = auditLogs || [];

      // Get cart items
      const { data: cartItems } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', targetUserId);
      userData.cart_items = cartItems || [];

      // Get reviews
      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', targetUserId);
      userData.reviews = reviews || [];

      // Get notifications
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', targetUserId);
      userData.notifications = notifications || [];

      // Log export request
      await supabase.from('activity_logs').insert({
        user_id: targetUserId,
        tenant_id: null,
        action: 'gdpr_data_export',
        resource: 'user',
        resource_id: targetUserId,
        metadata: {
          exported_by: user.id,
          export_date: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: userData,
          exported_at: new Date().toISOString(),
          format: 'json',
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="gdpr-export-${targetUserId}-${Date.now()}.json"`,
          },
        }
      );
    } catch (error) {
      console.error('GDPR export error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to export data',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

