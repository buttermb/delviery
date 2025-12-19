import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

const eraseSchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  confirm: z.boolean().refine((val) => val === true, {
    message: 'Must confirm deletion',
  }),
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

      // Parse and validate request
      const body = await req.json();
      const { user_id, email, confirm } = eraseSchema.parse(body);

      if (!confirm) {
        return new Response(
          JSON.stringify({ error: 'Deletion must be confirmed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get target user ID
      let targetUserId = user_id || user.id;
      
      if (email && email !== user.email) {
        // Only allow users to delete their own data unless super admin
        const { data: superAdmin } = await supabase
          .from('super_admin_users')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (!superAdmin) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized - can only delete own data' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get user by email
        const { data: targetUser } = await supabase.auth.admin.listUsers();
        const foundUser = targetUser?.users.find((u) => u.email === email);
        if (foundUser) {
          targetUserId = foundUser.id;
        }
      }

      // Anonymize or delete user data
      // Note: Some data must be retained for legal/tax purposes (7 years)
      const anonymizedEmail = `deleted_${targetUserId.substring(0, 8)}@deleted.local`;
      const anonymizedName = 'Deleted User';

      // Anonymize profile
      await supabase
        .from('profiles')
        .update({
          phone: null,
          age_verified: false,
          id_document_url: null,
        })
        .eq('user_id', targetUserId);

      // Delete cart items
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', targetUserId);

      // Anonymize addresses (keep for order history but remove PII)
      await supabase
        .from('addresses')
        .update({
          street: '[REDACTED]',
          city: '[REDACTED]',
          state: '[REDACTED]',
          zip_code: '[REDACTED]',
          phone: null,
        })
        .eq('user_id', targetUserId);

      // Anonymize orders (keep for tax/legal but remove PII)
      await supabase
        .from('orders')
        .update({
          customer_name: anonymizedName,
          customer_phone: null,
          delivery_address: '[REDACTED]',
        })
        .eq('user_id', targetUserId);

      // Delete reviews
      await supabase
        .from('reviews')
        .delete()
        .eq('user_id', targetUserId);

      // Delete notifications
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', targetUserId);

      // Anonymize activity logs
      await supabase
        .from('activity_logs')
        .update({
          metadata: {
            anonymized: true,
            original_user_id: targetUserId,
          },
        })
        .eq('user_id', targetUserId);

      // Delete auth user (Supabase Admin API)
      try {
        await supabase.auth.admin.deleteUser(targetUserId);
      } catch (deleteError) {
        console.error('Failed to delete auth user:', deleteError);
        // Continue with data deletion even if auth deletion fails
      }

      // Log deletion request
      await supabase.from('activity_logs').insert({
        user_id: null,
        tenant_id: null,
        action: 'gdpr_data_erasure',
        resource: 'user',
        resource_id: targetUserId,
        metadata: {
          deleted_by: user.id,
          deletion_date: new Date().toISOString(),
          anonymized: true,
        },
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User data has been anonymized and deleted',
          deleted_at: new Date().toISOString(),
          note: 'Some data retained for legal/tax compliance (7 years)',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('GDPR erase error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Failed to erase data',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

