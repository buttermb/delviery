import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '../_shared/rateLimiting.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('process-payment');

const VALID_CRYPTO_TYPES = ['bitcoin', 'lightning', 'ethereum', 'usdt'] as const;
type CryptoType = typeof VALID_CRYPTO_TYPES[number];

const paymentSchema = z.object({
  order_id: z.string().uuid(),
  payment_method: z.enum(['cash', 'card', 'crypto']),
  amount: z.number().positive(),
  retry_count: z.number().int().min(0).max(3).default(0),
  crypto_type: z.enum(VALID_CRYPTO_TYPES).optional(),
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
      const { order_id, payment_method, amount, retry_count, crypto_type } = paymentSchema.parse(body);

      // Validate crypto_type is provided when payment_method is crypto
      if (payment_method === 'crypto' && !crypto_type) {
        return new Response(
          JSON.stringify({ error: 'crypto_type is required for crypto payments' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
        // Crypto payment — peer-to-peer via tenant wallet addresses
        // Look up tenant's payment settings to get wallet address
        const { data: paymentSettings, error: settingsError } = await supabase
          .from('tenant_payment_settings')
          .select('accept_bitcoin, accept_lightning, accept_ethereum, accept_usdt, bitcoin_address, lightning_address, ethereum_address, usdt_address, crypto_instructions')
          .eq('tenant_id', tenant_id)
          .maybeSingle();

        if (settingsError) {
          logger.error('Failed to fetch payment settings', { tenantId: tenant_id, error: settingsError.message });
          return new Response(
            JSON.stringify({ error: 'Failed to load payment configuration' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!paymentSettings) {
          return new Response(
            JSON.stringify({ error: 'Crypto payments are not configured for this merchant' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Map crypto_type to the corresponding accept flag and address field
        const cryptoConfig: Record<CryptoType, { acceptKey: string; addressKey: string; label: string }> = {
          bitcoin: { acceptKey: 'accept_bitcoin', addressKey: 'bitcoin_address', label: 'Bitcoin' },
          lightning: { acceptKey: 'accept_lightning', addressKey: 'lightning_address', label: 'Lightning' },
          ethereum: { acceptKey: 'accept_ethereum', addressKey: 'ethereum_address', label: 'Ethereum' },
          usdt: { acceptKey: 'accept_usdt', addressKey: 'usdt_address', label: 'USDT' },
        };

        const config = cryptoConfig[crypto_type!];
        const isAccepted = paymentSettings[config.acceptKey as keyof typeof paymentSettings];
        const walletAddress = paymentSettings[config.addressKey as keyof typeof paymentSettings] as string | null;

        if (!isAccepted) {
          return new Response(
            JSON.stringify({ error: `${config.label} payments are not enabled for this merchant` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!walletAddress) {
          return new Response(
            JSON.stringify({ error: `${config.label} wallet address is not configured` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate a unique transaction reference for tracking
        const txRef = `CRYPTO-${crypto_type!.toUpperCase()}-${order_id.substring(0, 8)}-${Date.now().toString(36)}`;

        logger.info('Crypto payment initiated', {
          tenantId: tenant_id,
          orderId: order_id,
          cryptoType: crypto_type,
          amount,
        });

        paymentResult = {
          success: true,
          payment_id: null,
          transaction_id: txRef,
          message: `Send ${config.label} payment to the provided address. Payment will be confirmed manually.`,
          wallet_address: walletAddress,
          crypto_type: crypto_type,
          crypto_instructions: paymentSettings.crypto_instructions,
        };
      }

      if (!paymentResult.success) {
        return new Response(
          JSON.stringify({ error: paymentResult.message || 'Payment processing failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Crypto and cash payments are pending until manually confirmed
      const isPendingPayment = payment_method === 'cash' || payment_method === 'crypto';

      // Update order payment status
      await supabase
        .from('orders')
        .update({
          payment_status: isPendingPayment ? 'pending' : 'paid',
          payment_method: payment_method,
          payment_transaction_id: paymentResult.transaction_id as string,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order_id)
        .eq('tenant_id', tenant_id);

      // Create payment record
      await supabase.from('customer_payments').insert({
        customer_id: order.user_id,
        order_id: order_id,
        amount: amount,
        payment_method: payment_method,
        payment_status: isPendingPayment ? 'pending' : 'completed',
        external_payment_reference: paymentResult.transaction_id as string,
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
          ...(payment_method === 'crypto' && { crypto_type }),
        },
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: paymentResult.payment_id,
            transaction_id: paymentResult.transaction_id,
            status: isPendingPayment ? 'pending' : 'completed',
            method: payment_method,
            client_secret: paymentResult.client_secret, // For Stripe
            ...(payment_method === 'crypto' && {
              crypto_type: paymentResult.crypto_type,
              wallet_address: paymentResult.wallet_address,
              crypto_instructions: paymentResult.crypto_instructions,
            }),
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
      logger.error('Payment processing error', { error: error instanceof Error ? error.message : 'Unknown error' });
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Payment processing failed',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);
