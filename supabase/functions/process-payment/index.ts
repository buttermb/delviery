import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '../_shared/rateLimiting.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('process-payment');

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
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      // Resolve tenant from user's JWT
      const { data: tenantUser, error: tenantUserError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (tenantUserError || !tenantUser) {
        return new Response(
          JSON.stringify({ error: 'Tenant not found for user' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tenant_id = tenantUser.tenant_id;

      // Get order — filtered by tenant_id to prevent cross-tenant access
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

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

      // Resolve account_id for logging and payment records
      const account_id = order.account_id;

      // Process payment based on method
      let paymentResult: Record<string, unknown> = {
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
          // Create Stripe payment intent with properly encoded metadata
          const params = new URLSearchParams({
            amount: Math.round(amount * 100).toString(),
            currency: 'usd',
            'metadata[order_id]': order_id,
            'metadata[user_id]': user.id,
          });

          const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
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
            client_secret: stripeData.client_secret,
          };
        } catch (stripeError) {
          // Retry logic
          if (retry_count < 3) {
            logger.warn('Payment retry', {
              userId: user.id,
              tenantId: tenant_id,
              retryCount: String(retry_count + 1),
              error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
            });

            // Log retry to activity_logs if account_id available
            if (account_id) {
              await supabase.from('activity_logs').insert({
                account_id,
                user_id: user.id,
                action: 'payment_retry',
                entity_type: 'order',
                entity_id: order_id,
                changes: {
                  payment_method: 'card',
                  retry_count: retry_count + 1,
                  error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
                },
              });
            }

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

      // Update order payment status (only columns that exist)
      await supabase
        .from('orders')
        .update({
          payment_status: payment_method === 'cash' ? 'pending' : 'paid',
          payment_method: payment_method,
        })
        .eq('id', order_id)
        .eq('tenant_id', tenant_id);

      // Create payment record if account_id and customer_id are available
      if (account_id && order.customer_id) {
        await supabase.from('customer_payments').insert({
          account_id,
          customer_id: order.customer_id,
          order_id: order_id,
          amount: amount,
          payment_method: payment_method,
          payment_status: payment_method === 'cash' ? 'pending' : 'completed',
          external_payment_reference: paymentResult.transaction_id as string | null,
        });
      }

      // Log payment to activity_logs if account_id available
      if (account_id) {
        await supabase.from('activity_logs').insert({
          account_id,
          user_id: user.id,
          action: 'payment_processed',
          entity_type: 'order',
          entity_id: order_id,
          changes: {
            payment_method,
            amount,
            transaction_id: paymentResult.transaction_id,
          },
        });
      }

      logger.info('Payment processed', {
        userId: user.id,
        tenantId: tenant_id,
        orderId: order_id,
        paymentMethod: payment_method,
      });

      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: paymentResult.payment_id,
            transaction_id: paymentResult.transaction_id,
            status: payment_method === 'cash' ? 'pending' : 'completed',
            method: payment_method,
            client_secret: paymentResult.client_secret,
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
      logger.error('Payment processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Payment processing failed',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);
