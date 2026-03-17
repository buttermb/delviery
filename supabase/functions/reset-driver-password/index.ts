import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function createLogger(functionName: string) {
  function formatLog(level: string, message: string, context?: Record<string, unknown>): string {
    return JSON.stringify({ timestamp: new Date().toISOString(), level, message, functionName, ...context });
  }
  return {
    debug: (message: string, context?: Record<string, unknown>) => console.debug(formatLog('debug', message, context)),
    info: (message: string, context?: Record<string, unknown>) => console.error(formatLog('info', message, context)),
    warn: (message: string, context?: Record<string, unknown>) => console.warn(formatLog('warn', message, context)),
    error: (message: string, context?: Record<string, unknown>) => console.error(formatLog('error', message, context)),
  };
}

const logger = createLogger('reset-driver-password');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const resetPasswordSchema = z.object({
  driver_id: z.string().uuid('Invalid driver ID'),
  method: z.enum(['email', 'manual']),
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
  require_change: z.boolean().default(false),
}).refine(
  (data) => data.method !== 'manual' || data.new_password,
  { message: 'new_password is required when method is manual', path: ['new_password'] },
);

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
      logger.warn('Non-admin attempted to reset driver password', { userId: user.id });
      return errorResponse(403, 'Admin access required', 'FORBIDDEN');
    }

    const tenantId = tenantUser.tenant_id;

    // -----------------------------------------------------------------------
    // 4. Validate request body
    // -----------------------------------------------------------------------
    const rawBody = await req.json();
    const validation = resetPasswordSchema.safeParse(rawBody);

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
      .select('id, tenant_id, user_id, email, full_name')
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

    if (!driver.user_id) {
      logger.error('Driver has no linked auth user', { driverId: driver.id });
      return errorResponse(500, 'Driver account is not properly linked', 'NO_AUTH_USER');
    }

    // -----------------------------------------------------------------------
    // 6. Reset password based on method
    // -----------------------------------------------------------------------
    let emailSent = false;

    if (input.method === 'email') {
      // Generate a magic link for password recovery
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: driver.email,
      });

      if (linkError) {
        logger.error('Failed to generate recovery link', { error: linkError.message });
        return errorResponse(500, 'Failed to generate recovery link', 'LINK_GENERATION_FAILED');
      }

      // Send email with reset link via Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const portalUrl = Deno.env.get('COURIER_PORTAL_URL') || `${Deno.env.get('SITE_URL') || ''}/courier`;

      // Extract the hashed_token from the generated link properties
      const actionLink = linkData?.properties?.action_link || '';

      if (resendApiKey) {
        try {
          const emailHtml = `
            <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
              <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Password Reset</h1>
              <p style="color: #6b7280; margin-bottom: 32px;">An administrator has requested a password reset for your driver account.</p>

              <a href="${actionLink}" style="display: inline-block; background: #10b981; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin-bottom: 24px;">Reset Your Password</a>

              <p style="color: #6b7280; font-size: 13px; margin-bottom: 8px;">Or copy this link:</p>
              <p style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 12px; word-break: break-all; margin-bottom: 24px;">${actionLink}</p>

              <p style="color: #ef4444; font-size: 13px; margin-bottom: 24px;">This link expires in 24 hours. If you did not request this, please contact your administrator.</p>

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
              subject: 'Reset Your FloraIQ Password',
              html: emailHtml,
            }),
          });

          if (resendResponse.ok) {
            emailSent = true;
            logger.info('Password reset email sent', { email: driver.email });
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
        logger.warn('RESEND_API_KEY not configured, skipping reset email');
      }
    } else {
      // method === 'manual'
      const { error: updateError } = await supabase.auth.admin.updateUserById(driver.user_id, {
        password: input.new_password!,
      });

      if (updateError) {
        logger.error('Failed to update password', { error: updateError.message });
        return errorResponse(500, 'Failed to update password', 'PASSWORD_UPDATE_FAILED');
      }

      // Set require_change flag in user_metadata
      if (input.require_change) {
        const { data: currentUser } = await supabase.auth.admin.getUserById(driver.user_id);
        const existingMetadata = currentUser?.user?.user_metadata || {};

        await supabase.auth.admin.updateUserById(driver.user_id, {
          user_metadata: {
            ...existingMetadata,
            require_password_change: true,
          },
        });
      }
    }

    // -----------------------------------------------------------------------
    // 7. Log to driver_activity_log
    // -----------------------------------------------------------------------
    await supabase.from('driver_activity_log').insert({
      tenant_id: tenantId,
      driver_id: driver.id,
      event_type: 'password_reset',
      event_data: {
        reset_by_email: user.email,
        method: input.method,
        require_change: input.require_change,
        email_sent: input.method === 'email' ? emailSent : undefined,
      },
      created_by: user.id,
    });

    // -----------------------------------------------------------------------
    // 8. Success response
    // -----------------------------------------------------------------------
    logger.info('Driver password reset successfully', {
      driverId: driver.id,
      tenantId,
      method: input.method,
    });

    return new Response(
      JSON.stringify({
        success: true,
        method: input.method,
        email_sent: input.method === 'email' ? emailSent : undefined,
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
