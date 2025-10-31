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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { client_id, amount, payment_method, reference_number, notes } = await req.json();

    // Validate input
    if (!client_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client
    const { data: client } = await supabaseClient
      .from('wholesale_clients')
      .select('outstanding_balance')
      .eq('id', client_id)
      .single();

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    if (paymentError) throw paymentError;

    // Update client outstanding balance
    const newBalance = Math.max(0, client.outstanding_balance - amount);
    
    const { error: updateError } = await supabaseClient
      .from('wholesale_clients')
      .update({ 
        outstanding_balance: newBalance,
        last_payment_date: new Date().toISOString()
      })
      .eq('id', client_id);

    if (updateError) throw updateError;

    // Update reliability score (improved payment history)
    await supabaseClient.rpc('update_client_reliability', {
      p_client_id: client_id,
      p_payment_made: true
    });

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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
