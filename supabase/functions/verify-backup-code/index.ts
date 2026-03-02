import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('verify-backup-code');

// Zod validation schema
const verifyBackupCodeSchema = z.object({
  code: z.string().min(8, 'Backup code must be at least 8 characters').max(20, 'Backup code too long'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify user (AAL1 session expected)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      logger.warn('Invalid session', { error: userError?.message });
      throw new Error('Invalid session');
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = verifyBackupCodeSchema.safeParse(rawBody);

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

    const { code } = validationResult.data;

    // Hash the code
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Service role client for admin actions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find valid unused code
    const { data: validCode, error: queryError } = await supabaseAdmin
      .from('user_backup_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .maybeSingle();

    if (queryError) {
      logger.error('Query error', { error: queryError.message, userId: user.id });
      throw queryError;
    }

    if (!validCode) {
      logger.warn('Invalid or used backup code', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Invalid or used backup code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as used
    await supabaseAdmin
      .from('user_backup_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', validCode.id);

    // Disable MFA (Unenroll all TOTP factors)
    const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: user.id,
    });

    const totpFactors = factors?.factors?.filter((f) => f.factor_type === 'totp') || [];

    for (const factor of totpFactors) {
      await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: user.id,
      });
    }

    logger.info('MFA disabled using backup code', { userId: user.id, factorsRemoved: totpFactors.length });

    return new Response(
      JSON.stringify({ success: true, message: 'MFA disabled using recovery code' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Verify backup code error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
