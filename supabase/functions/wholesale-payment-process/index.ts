import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const PaymentSchema = z.object({
  client_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.error('[wholesale-payment-process] Starting payment processing');

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

    // Resolve tenant
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
    const body = await req.json();
    const parsed = PaymentSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[wholesale-payment-process] Validation failed:', parsed.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid payment details', details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { client_id, amount, payment_method, reference_number, notes } = parsed.data;
    console.error('[wholesale-payment-process] Received payment request', JSON.stringify({ client_id, amount, payment_method }));

    // Get client (tenant-scoped)
    const { data: client, error: clientError } = await supabaseClient
      .from('wholesale_clients')
      .select('outstanding_balance')
      .eq('id', client_id)
      .eq('tenant_id', tenantUser.tenant_id)
      .maybeSingle();

    if (clientError) {
      console.error('[wholesale-payment-process] Client fetch error:', clientError.message);
      return new Response(
        JSON.stringify({ error: `Client error: ${clientError.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client) {
      console.error('[wholesale-payment-process] Client not found');
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.error('[wholesale-payment-process] Found client with balance:', client.outstanding_balance);

    // Attempt atomic payment processing via RPC
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let paymentId: string | undefined;
    let newBalance: number;

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc('process_wholesale_payment', {
      p_client_id: client_id,
      p_amount: amount,
      p_payment_method: payment_method || 'cash',
      p_reference_number: reference_number || null,
      p_notes: notes || null,
      p_tenant_id: tenantUser.tenant_id,
    });

    if (rpcError) {
      // RPC doesn't exist or failed — fall back to manual approach
      console.error('[wholesale-payment-process] RPC unavailable, using fallback:', rpcError.message);

      // Create payment record
      const { data: payment, error: paymentError } = await supabaseClient
        .from('wholesale_payments')
        .insert({
          client_id,
          amount,
          payment_method: payment_method || 'cash',
          reference_number: reference_number || null,
          notes: notes || null,
          status: 'completed',
          tenant_id: tenantUser.tenant_id,
        })
        .select()
        .single();

      if (paymentError) {
        console.error('[wholesale-payment-process] Payment insert error:', paymentError.message);
        throw new Error(`Payment insert failed: ${paymentError.message}`);
      }

      paymentId = payment.id;
      console.error('[wholesale-payment-process] Payment record created:', paymentId);

      // Update client outstanding balance (tenant-scoped)
      newBalance = Math.max(0, (client.outstanding_balance || 0) - amount);

      const { error: updateError } = await supabaseClient
        .from('wholesale_clients')
        .update({
          outstanding_balance: newBalance,
          last_payment_date: new Date().toISOString(),
        })
        .eq('id', client_id)
        .eq('tenant_id', tenantUser.tenant_id);

      if (updateError) {
        console.error('[wholesale-payment-process] Balance update error:', updateError.message);
        throw new Error(`Balance update failed: ${updateError.message}`);
      }
    } else {
      // RPC succeeded — extract results
      paymentId = rpcResult?.payment_id;
      newBalance = rpcResult?.new_balance ?? Math.max(0, (client.outstanding_balance || 0) - amount);
      console.error('[wholesale-payment-process] Atomic RPC completed, payment:', paymentId);
    }

    console.error('[wholesale-payment-process] Balance updated to:', newBalance);

    // Try to update reliability score (optional - don't fail if RPC doesn't exist)
    try {
      await supabaseClient.rpc('update_client_reliability', {
        p_client_id: client_id,
        p_payment_made: true,
      });
      console.error('[wholesale-payment-process] Reliability score updated');
    } catch (reliabilityError) {
      console.error('[wholesale-payment-process] Reliability RPC failed (non-critical):', reliabilityError);
    }

    console.error('[wholesale-payment-process] Payment completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentId,
        new_balance: newBalance,
        amount_paid: amount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[wholesale-payment-process] Unexpected error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
