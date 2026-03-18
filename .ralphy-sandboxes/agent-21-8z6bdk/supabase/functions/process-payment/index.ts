import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '../_shared/rateLimiting.ts';

const paymentSchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(['cash', 'card', 'crypto']),
  amount: z.number().positive(),
  retry_count: z.number().int().min(0).max(3).default(0),
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

      // Rate limiting
      const rateLimitResult = await checkRateLimit(
        RATE_LIMITS.ORDER_CREATE,
        user.id
      );

      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many payment attempts. Please try again later.',
            resetAt: rateLimitResult.resetAt,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              ...getRateLimitHeaders(rateLimitResult),
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Parse and validate request
      const body = await req.json();
      const { order_id, payment_method, amount, retry_count } = paymentSchema.parse(body);

      // Get order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify amount matches
      if (Math.abs(amount - parseFloat(order.total_amount.toString())) > 0.01) {
        return new Response(
          JSON.stringify({ error: 'Amount mismatch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process payment based on method
      let paymentResult: any = {
        success: false,
        payment_id: null,
        transaction_id: null,
        message: '',
      };

      if (payment_method === 'cash') {
        // Cash on delivery - mark as pending, will be confirmed on delivery
        paymentResult = {
          success: true,
          payment_id: null,
          transaction_id: `CASH-${order_id.substring(0, 8)}`,
          message: 'Payment will be collected on delivery',
        };
      } else if (payment_method === 'card') {
        // Stripe payment processing
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        
        if (!stripeSecretKey) {
          return new Response(
            JSON.stringify({ error: 'Stripe not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          // Create Stripe payment intent
          const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              amount: Math.round(amount * 100).toString(), // Convert to cents
              currency: 'usd',
              metadata: JSON.stringify({
                order_id: order_id,
                user_id: user.id,
              }),
            }),
          });

          const stripeData = await stripeResponse.json();

          if (!stripeResponse.ok) {
            throw new Error(stripeData.error?.message || 'Stripe payment failed');
          }

          paymentResult = {
            success: true,
            payment_id: stripeData.id,
            transaction_id: stripeData.id,
            message: 'Payment processed successfully',
            client_secret: stripeData.client_secret, // For frontend confirmation
          };
        } catch (stripeError) {
          // Retry logic
          if (retry_count < 3) {
            // Log retry
            await supabase.from('activity_logs').insert({
              user_id: user.id,
              tenant_id: order.tenant_id,
              action: 'payment_retry',
              resource: 'order',
              resource_id: order_id,
              metadata: {
                payment_method: 'card',
                retry_count: retry_count + 1,
                error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
              },
              created_at: new Date().toISOString(),
            });

            // Return retry instruction
            return new Response(
              JSON.stringify({
                error: 'Payment processing failed',
                message: 'Payment failed. Please try again.',
                retry: true,
                retry_count: retry_count + 1,
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          throw stripeError;
        }
      } else if (payment_method === 'crypto') {
        // Crypto payment (placeholder - integrate with crypto processor)
        paymentResult = {
          success: false,
          payment_id: null,
          transaction_id: null,
          message: 'Crypto payments not yet implemented',
        };
      }

      if (!paymentResult.success) {
        return new Response(
          JSON.stringify({ error: paymentResult.message || 'Payment processing failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update order payment status
      await supabase
        .from('orders')
        .update({
          payment_status: payment_method === 'cash' ? 'pending' : 'paid',
          payment_method: payment_method,
          payment_transaction_id: paymentResult.transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id);

      // Create payment record
      await supabase.from('customer_payments').insert({
        customer_id: order.user_id,
        order_id: order_id,
        amount: amount,
        payment_method: payment_method,
        payment_status: payment_method === 'cash' ? 'pending' : 'completed',
        external_payment_reference: paymentResult.transaction_id,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      });

      // Log payment
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        tenant_id: order.tenant_id,
        action: 'payment_processed',
        resource: 'order',
        resource_id: order_id,
        metadata: {
          payment_method,
          amount,
          transaction_id: paymentResult.transaction_id,
        },
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: paymentResult.payment_id,
            transaction_id: paymentResult.transaction_id,
            status: payment_method === 'cash' ? 'pending' : 'completed',
            method: payment_method,
            client_secret: paymentResult.client_secret, // For Stripe
          },
          message: paymentResult.message,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            ...getRateLimitHeaders(rateLimitResult),
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Payment processing error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Payment processing failed',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

