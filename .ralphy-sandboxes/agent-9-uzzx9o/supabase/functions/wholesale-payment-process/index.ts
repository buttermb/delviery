import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('wholesale-payment-process: Starting payment processing');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { client_id, amount, payment_method, reference_number, notes } = await req.json();
    console.log('wholesale-payment-process: Received payment request', { client_id, amount, payment_method });

    // Validate input
    if (!client_id || !amount || amount <= 0) {
      console.error('wholesale-payment-process: Invalid payment details');
      return new Response(
        JSON.stringify({ error: 'Invalid payment details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client
    const { data: client, error: clientError } = await supabaseClient
      .from('wholesale_clients')
      .select('outstanding_balance')
      .eq('id', client_id)
      .single();

    if (clientError) {
      console.error('wholesale-payment-process: Client fetch error', clientError);
      return new Response(
        JSON.stringify({ error: `Client error: ${clientError.message}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client) {
      console.error('wholesale-payment-process: Client not found');
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('wholesale-payment-process: Found client with balance', client.outstanding_balance);

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from('wholesale_payments')
      .insert({
        client_id,
        amount,
        payment_method: payment_method || 'cash',
        reference_number,
        notes,
        status: 'completed'
      })
      .select()
      .single();

    if (paymentError) {
      console.error('wholesale-payment-process: Payment insert error', paymentError);
      throw new Error(`Payment insert failed: ${paymentError.message}`);
    }

    console.log('wholesale-payment-process: Payment record created', payment.id);

    // Update client outstanding balance
    const newBalance = Math.max(0, (client.outstanding_balance || 0) - amount);
    
    const { error: updateError } = await supabaseClient
      .from('wholesale_clients')
      .update({ 
        outstanding_balance: newBalance,
        last_payment_date: new Date().toISOString()
      })
      .eq('id', client_id);

    if (updateError) {
      console.error('wholesale-payment-process: Balance update error', updateError);
      throw new Error(`Balance update failed: ${updateError.message}`);
    }

    console.log('wholesale-payment-process: Balance updated to', newBalance);

    // Try to update reliability score (optional - don't fail if RPC doesn't exist)
    try {
      await supabaseClient.rpc('update_client_reliability', {
        p_client_id: client_id,
        p_payment_made: true
      });
      console.log('wholesale-payment-process: Reliability score updated');
    } catch (rpcError) {
      // RPC might not exist, log but don't fail
      console.warn('wholesale-payment-process: Reliability RPC failed (non-critical)', rpcError);
    }

    console.log('wholesale-payment-process: Payment completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        payment_id: payment.id,
        new_balance: newBalance,
        amount_paid: amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('wholesale-payment-process: Unexpected error', errorMessage, error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
