import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const AssignSchema = z.object({
  order_id: z.string().uuid(),
  runner_id: z.string().uuid(),
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

    // Tenant resolution
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

    // Validate input with Zod
    const parsed = AssignSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { order_id, runner_id } = parsed.data;

    // Check if order exists and is assignable (confirmed or ready)
    const { data: order } = await supabaseClient
      .from('wholesale_orders')
      .select('status')
      .eq('id', order_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    if (!order || !['confirmed', 'ready'].includes(order.status)) {
      return new Response(
        JSON.stringify({ error: 'Order not available for assignment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if runner exists and is available
    const { data: runner } = await supabaseClient
      .from('wholesale_runners')
      .select('status')
      .eq('id', runner_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    if (!runner || runner.status !== 'available') {
      return new Response(
        JSON.stringify({ error: 'Runner not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create delivery record
    const { data: delivery, error: deliveryError } = await supabaseClient
      .from('wholesale_deliveries')
      .insert({
        order_id,
        runner_id,
        status: 'assigned',
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (deliveryError) throw deliveryError;

    // Update order status
    await supabaseClient
      .from('wholesale_orders')
      .update({ status: 'shipped' })
      .eq('id', order_id);

    // Update runner status
    await supabaseClient
      .from('wholesale_runners')
      .update({ status: 'on_delivery' })
      .eq('id', runner_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        delivery_id: delivery.id,
        message: 'Delivery assigned successfully'
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
