import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const DeliveryUpdateSchema = z.object({
  delivery_id: z.string().uuid(),
  status: z.enum(['assigned', 'picked_up', 'in_transit', 'delivered', 'failed']),
  location: z.string().optional(),
  notes: z.string().optional(),
});

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

    // Validate input with Zod
    const parseResult = DeliveryUpdateSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { delivery_id, status, location, notes } = parseResult.data;

    // Tenant verification
    const { data: tenantUser } = await supabaseClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get delivery info
    const { data: delivery } = await supabaseClient
      .from('wholesale_deliveries')
      .select('order_id, runner_id, status')
      .eq('id', delivery_id)
      .single();

    if (!delivery) {
      return new Response(
        JSON.stringify({ error: 'Delivery not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify order belongs to tenant
    const { data: order } = await supabaseClient
      .from('wholesale_orders')
      .select('id')
      .eq('id', delivery.order_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Not authorized for this delivery' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update delivery record
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'picked_up') updateData.picked_up_at = new Date().toISOString();
    if (status === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (location) updateData.current_location = location;
    if (notes) updateData.notes = notes;

    const { error: updateError } = await supabaseClient
      .from('wholesale_deliveries')
      .update(updateData)
      .eq('id', delivery_id);

    if (updateError) throw updateError;

    // Update order status (aligned with wholesale order flow manager)
    const orderStatusMap: Record<string, string> = {
      'delivered': 'delivered',
      'failed': 'cancelled',
      'picked_up': 'shipped',
      'in_transit': 'shipped',
      'assigned': 'shipped',
    };
    const orderStatus = orderStatusMap[status] || null;

    if (orderStatus) {
      await supabaseClient
        .from('wholesale_orders')
        .update({ status: orderStatus })
        .eq('id', delivery.order_id);
    }

    // If delivered, update runner status to available
    if (status === 'delivered' || status === 'failed') {
      await supabaseClient
        .from('wholesale_runners')
        .update({ status: 'available' })
        .eq('id', delivery.runner_id);

      // Update runner stats
      if (status === 'delivered') {
        await supabaseClient.rpc('increment_runner_deliveries', {
          p_runner_id: delivery.runner_id
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Delivery status updated to ${status}`
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
