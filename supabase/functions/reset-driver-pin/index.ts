import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { hashPassword } from '../_shared/password.ts';

const logger = createLogger('reset-driver-pin');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const resetPinSchema = z.object({
  driver_id: z.string().uuid('Invalid driver ID'),
  pin: z
    .string()
    .regex(/^\d{6}$/, 'PIN must be exactly 6 digits')
    .optional(),
  notify_email: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function errorResponse(
  status: number,
  error: string,
  code: string,
) {
  return new Response(
    JSON.stringify({ success: false, error, code }),
    { status, headers: jsonHeaders },
  );
}

function generatePin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Init admin client
    // -----------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // -----------------------------------------------------------------------
    // 2. Authenticate caller
    // -----------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logger.warn('Missing authorization header');
      return errorResponse(401, 'Missing authorization header', 'UNAUTHORIZED');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Invalid token', { error: authError?.message });
      return errorResponse(401, 'Unauthorized', 'UNAUTHORIZED');
    }

    // -----------------------------------------------------------------------
    // 3. Verify tenant admin role via tenant_users
    // -----------------------------------------------------------------------
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('role', ['super_admin', 'admin', 'owner', 'manager'])
      .maybeSingle();

    if (!tenantUser) {
      logger.warn('Non-admin attempted to reset driver PIN', { userId: user.id });
      return errorResponse(403, 'Admin access required', 'FORBIDDEN');
    }

    const tenantId = tenantUser.tenant_id;

    // -----------------------------------------------------------------------
    // 4. Validate request body
    // -----------------------------------------------------------------------
    const rawBody = await req.json();
    const validation = resetPinSchema.safeParse(rawBody);

    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors as Record<string, string[]>;
      logger.warn('Validation failed', { errors: fieldErrors });
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR');
    }

    const input = validation.data;

    // -----------------------------------------------------------------------
    // 5. Look up driver and verify tenant ownership
    // -----------------------------------------------------------------------
    const { data: driver } = await supabase
      .from('couriers')
      .select('id, tenant_id, email, full_name, user_id')
      .eq('id', input.driver_id)
      .maybeSingle();

    if (!driver) {
      logger.warn('Driver not found', { driverId: input.driver_id });
      return errorResponse(404, 'Driver not found', 'DRIVER_NOT_FOUND');
    }

    if (driver.tenant_id !== tenantId) {
      logger.warn('Driver belongs to different tenant', {
        driverId: input.driver_id,
        driverTenant: driver.tenant_id,
        callerTenant: tenantId,
      });
      return errorResponse(403, 'Driver does not belong to your organization', 'FORBIDDEN');
    }

    // -----------------------------------------------------------------------
    // 6. Generate or use provided PIN, then hash
    // -----------------------------------------------------------------------
    const pin = input.pin || generatePin();
    const pinHash = await hashPassword(pin);

    // -----------------------------------------------------------------------
    // 7. Update couriers table
    // -----------------------------------------------------------------------
    const { error: updateError } = await supabase
      .from('couriers')
      .update({
        pin_hash: pinHash,
        pin_updated_at: new Date().toISOString(),
      })
      .eq('id', driver.id);

    if (updateError) {
      logger.error('Failed to update PIN', { error: updateError.message });
      return errorResponse(500, 'Failed to update PIN', 'UPDATE_FAILED');
    }

    // Also update user_metadata for backward compat with add-driver
    if (driver.user_id) {
      await supabase.auth.admin.updateUserById(driver.user_id, {
        user_metadata: { pin_hash: pinHash },
      });
    }

    // -----------------------------------------------------------------------
    // 8. Log to driver_activity_log
    // -----------------------------------------------------------------------
    await supabase.from('driver_activity_log').insert({
      tenant_id: tenantId,
      driver_id: driver.id,
      event_type: 'pin_reset',
      event_data: {
        reset_by_email: user.email,
        custom_pin_provided: Boolean(input.pin),
        notify_email: input.notify_email,
      },
      created_by: user.id,
    });

    // -----------------------------------------------------------------------
    // 9. Send notification email (if requested)
    // -----------------------------------------------------------------------
    let emailSent = false;

    if (input.notify_email) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      if (resendApiKey) {
        try {
          const emailHtml = `
            <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
              <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">PIN Reset</h1>
              <p style="color: #6b7280; margin-bottom: 32px;">Your driver PIN has been reset by an administrator.</p>

              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0;"><strong>New PIN:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 18px; letter-spacing: 2px;">${pin}</code></p>
              </div>

              <p style="color: #ef4444; font-size: 13px; margin-bottom: 24px;">This PIN is required for order verification. Do not share it with anyone.</p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
              <p style="color: #9ca3af; font-size: 12px;">This is an automated message from FloraIQ. Do not reply to this email.</p>
            </div>
          `;

          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: 'FloraIQ <noreply@resend.dev>',
              to: [driver.email],
              subject: 'Your FloraIQ PIN Has Been Reset',
              html: emailHtml,
            }),
          });

          if (resendResponse.ok) {
            emailSent = true;
            logger.info('PIN reset email sent', { email: driver.email });
          } else {
            const errorData = await resendResponse.json();
            logger.error('Resend API error', { error: JSON.stringify(errorData) });
          }
        } catch (emailError) {
          logger.error('Email send failed', {
            error: emailError instanceof Error ? emailError.message : 'Unknown',
          });
        }
      } else {
        logger.warn('RESEND_API_KEY not configured, skipping notification email');
      }
    }

    // -----------------------------------------------------------------------
    // 10. Success response
    // -----------------------------------------------------------------------
    logger.info('Driver PIN reset successfully', {
      driverId: driver.id,
      tenantId,
      emailSent: String(emailSent),
    });

    return new Response(
      JSON.stringify({
        success: true,
        pin,
        email_sent: emailSent,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (error) {
    logger.error('Unexpected error', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(500, 'Internal server error', 'INTERNAL_ERROR');
  }
});
