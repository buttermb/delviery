import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('verify-age-jumio');

// Zod validation schema
const verifyAgeSchema = z.object({
  returnUrl: z.string().url('Return URL must be a valid URL'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const jumioToken = Deno.env.get('JUMIO_API_TOKEN');
    const jumioSecret = Deno.env.get('JUMIO_API_SECRET');

    if (!jumioToken || !jumioSecret) {
      logger.warn('Jumio not configured');
      return new Response(
        JSON.stringify({
          error: 'Age verification service not configured. Contact support.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = verifyAgeSchema.safeParse(rawBody);

    if (!validationResult.success) {
      const zodError = validationResult as { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } };
      logger.warn('Validation failed', { errors: zodError.error.flatten(), userId: user.id });
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: zodError.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { returnUrl } = validationResult.data;

    // Create Jumio verification session
    const jumioAuth = btoa(`${jumioToken}:${jumioSecret}`);
    const jumioResponse = await fetch('https://account.amer-1.jumio.ai/api/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${jumioAuth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Bud-Dash NYC/1.0',
      },
      body: JSON.stringify({
        customerInternalReference: user.id,
        userReference: user.id,
        callbackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/jumio-callback`,
        successUrl: returnUrl,
        errorUrl: returnUrl,
        workflowDefinition: {
          key: 91,
          credentials: [
            {
              category: 'ID',
              type: { values: ['DRIVING_LICENSE', 'ID_CARD', 'PASSPORT'] },
              country: { values: ['USA'] },
            },
          ],
        },
      }),
    });

    if (!jumioResponse.ok) {
      const errorText = await jumioResponse.text();
      logger.error('Jumio API error', { status: jumioResponse.status, error: errorText, userId: user.id });
      throw new Error(`Jumio verification failed: ${jumioResponse.status}`);
    }

    const jumioData = await jumioResponse.json();

    // Store verification record
    await supabase.from('age_verifications').insert({
      user_id: user.id,
      verification_type: 'registration',
      verification_method: 'jumio',
      verified: false,
    });

    // Create audit log
    await supabase.from('audit_logs').insert({
      entity_type: 'age_verification',
      entity_id: user.id,
      action: 'INITIATED',
      user_id: user.id,
    });

    logger.info('Age verification initiated', { userId: user.id });

    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl: jumioData.redirectUrl,
        transactionReference: jumioData.transactionReference,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Age verification error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Age verification failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
