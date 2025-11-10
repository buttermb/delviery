import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const notificationSchema = z.object({
  user_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  type: z.enum(['order_status', 'order_cancelled', 'payment', 'inventory', 'system']),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  metadata: z.record(z.any()).optional(),
  channels: z.array(z.enum(['database', 'email', 'push'])).default(['database']),
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

      // Parse and validate request
      const body = await req.json();
      const notificationData = notificationSchema.parse(body);

      const results: Record<string, any> = {};

      // Send to database (always)
      if (notificationData.channels.includes('database')) {
        const { data: notification, error: dbError } = await supabase
          .from('notifications')
          .insert({
            user_id: notificationData.user_id || null,
            tenant_id: notificationData.tenant_id || null,
            type: notificationData.type,
            title: notificationData.title,
            message: notificationData.message,
            metadata: notificationData.metadata || {},
            read: false,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (dbError) {
          results.database = { error: dbError.message };
        } else {
          results.database = { success: true, id: notification.id };
        }
      }

      // Send email (if requested and user_id provided)
      if (notificationData.channels.includes('email') && notificationData.user_id) {
        // Get user email
        const { data: user } = await supabase.auth.admin.getUserById(notificationData.user_id);
        
        if (user?.user?.email) {
          // In production, integrate with email service (SendGrid, Resend, etc.)
          // For now, just log
          console.log('Email notification would be sent to:', user.user.email);
          results.email = { success: true, sent: false, note: 'Email service not configured' };
        } else {
          results.email = { error: 'User email not found' };
        }
      }

      // Send push notification (if requested and user_id provided)
      if (notificationData.channels.includes('push') && notificationData.user_id) {
        // In production, integrate with FCM/APNS
        // For now, just log
        console.log('Push notification would be sent to user:', notificationData.user_id);
        results.push = { success: true, sent: false, note: 'Push service not configured' };
      }

      return new Response(
        JSON.stringify({
          success: true,
          results,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Send notification error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to send notification',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

