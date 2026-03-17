import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('suspend-driver');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const suspendDriverSchema = z.object({
  driver_id: z.string().uuid('Invalid driver ID'),
  reason: z.string().min(1, 'Reason is required').max(2000),
  notes: z.string().max(2000).optional(),
  duration_days: z.number().int().min(1).max(365).nullable().default(null),
  notify_email: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function errorResponse(status: number, error: string, code: string) {
  return new Response(
    JSON.stringify({ success: false, error, code }),
    { status, headers: jsonHeaders },
  );
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
      logger.warn('Non-admin attempted to suspend driver', { userId: user.id });
      return errorResponse(403, 'Admin access required', 'FORBIDDEN');
    }

    const tenantId = tenantUser.tenant_id;

    // -----------------------------------------------------------------------
    // 4. Validate request body
    // -----------------------------------------------------------------------
    const rawBody = await req.json();
    const validation = suspendDriverSchema.safeParse(rawBody);

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
      .select('id, tenant_id, user_id, email, full_name, status, notes')
      .eq('id', input.driver_id)
      .maybeSingle();

    if (!driver) {
      logger.warn('Driver not found', { driverId: input.driver_id });
      return errorResponse(404, 'Driver not found', 'DRIVER_NOT_FOUND');
    }

    if (driver.tenant_id !== tenantId) {
      logger.warn('Driver belongs to different tenant', {
        driverId: input.driver_id,
        callerTenant: tenantId,
      });
      return errorResponse(403, 'Driver does not belong to your organization', 'FORBIDDEN');
    }

    if (driver.status === 'terminated') {
      return errorResponse(400, 'Cannot suspend a terminated driver', 'ALREADY_TERMINATED');
    }

    if (driver.status === 'suspended') {
      return errorResponse(400, 'Driver is already suspended', 'ALREADY_SUSPENDED');
    }

    const previousStatus = driver.status;

    // -----------------------------------------------------------------------
    // 6. Update couriers table
    // -----------------------------------------------------------------------
    const now = new Date().toISOString();
    const suspendedUntil = input.duration_days
      ? new Date(Date.now() + input.duration_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: updateError } = await supabase
      .from('couriers')
      .update({
        status: 'suspended',
        availability: 'offline',
        is_active: false,
        is_online: false,
        suspended_at: now,
        suspended_until: suspendedUntil,
        suspend_reason: input.reason,
        notes: input.notes || driver.notes,
      })
      .eq('id', driver.id);

    if (updateError) {
      logger.error('Failed to suspend driver', { error: updateError.message });
      return errorResponse(500, 'Failed to suspend driver', 'UPDATE_FAILED');
    }

    // -----------------------------------------------------------------------
    // 7. Revoke active sessions via ban
    // -----------------------------------------------------------------------
    if (driver.user_id) {
      const banDuration = input.duration_days
        ? `${input.duration_days * 24}h`
        : '876000h'; // ~100 years for indefinite

      const { error: banError } = await supabase.auth.admin.updateUserById(
        driver.user_id,
        { ban_duration: banDuration },
      );

      if (banError) {
        logger.error('Failed to ban auth user', { error: banError.message });
        // Non-fatal: driver record is already suspended
      } else {
        logger.info('Auth user banned', {
          userId: driver.user_id,
          duration: banDuration,
        });
      }
    }

    // -----------------------------------------------------------------------
    // 8. Log to driver_activity_log
    // -----------------------------------------------------------------------
    await supabase.from('driver_activity_log').insert({
      tenant_id: tenantId,
      driver_id: driver.id,
      event_type: 'status_changed',
      event_data: {
        from: previousStatus,
        to: 'suspended',
        reason: input.reason,
        notes: input.notes || null,
        duration_days: input.duration_days,
        suspended_until: suspendedUntil,
        suspended_by_email: user.email,
      },
      created_by: user.id,
    });

    // -----------------------------------------------------------------------
    // 9. Send notification email (if requested)
    // -----------------------------------------------------------------------
    let emailSent = false;

    if (input.notify_email && driver.email) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');

      if (resendApiKey) {
        try {
          const durationText = input.duration_days
            ? `${input.duration_days} day${input.duration_days > 1 ? 's' : ''}`
            : 'indefinitely';

          const untilText = suspendedUntil
            ? new Date(suspendedUntil).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'further notice';

          const emailHtml = `
            <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
              <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Account Suspended</h1>
              <p style="color: #6b7280; margin-bottom: 32px;">Your driver account has been suspended ${durationText}.</p>

              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0;"><strong>Reason:</strong> ${input.reason}</p>
                <p style="margin: 0;"><strong>Suspended until:</strong> ${untilText}</p>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">During this period you will not be able to log in or receive deliveries. If you believe this is an error, please contact your administrator.</p>

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
              subject: 'Your FloraIQ Account Has Been Suspended',
              html: emailHtml,
            }),
          });

          if (resendResponse.ok) {
            emailSent = true;
            logger.info('Suspension email sent', { email: driver.email });
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
        logger.warn('RESEND_API_KEY not configured, skipping suspension email');
      }
    }

    // -----------------------------------------------------------------------
    // 10. Success response
    // -----------------------------------------------------------------------
    logger.info('Driver suspended successfully', {
      driverId: driver.id,
      tenantId,
      durationDays: String(input.duration_days ?? 'indefinite'),
      emailSent: String(emailSent),
    });

    return new Response(
      JSON.stringify({
        success: true,
        suspended_until: suspendedUntil,
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
