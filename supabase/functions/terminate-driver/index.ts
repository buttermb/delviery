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

const logger = createLogger('terminate-driver');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const terminateDriverSchema = z.object({
  driver_id: z.string().uuid('Invalid driver ID'),
  reason: z.string().min(1, 'Reason is required').max(2000),
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
      logger.warn('Non-admin attempted to terminate driver', { userId: user.id });
      return errorResponse(403, 'Admin access required', 'FORBIDDEN');
    }

    const tenantId = tenantUser.tenant_id;

    // -----------------------------------------------------------------------
    // 4. Validate request body
    // -----------------------------------------------------------------------
    const rawBody = await req.json();
    const validation = terminateDriverSchema.safeParse(rawBody);

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
      .select('id, tenant_id, user_id, email, full_name, status')
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
      return errorResponse(400, 'Driver is already terminated', 'ALREADY_TERMINATED');
    }

    const previousStatus = driver.status;

    // -----------------------------------------------------------------------
    // 6. Update couriers table
    // -----------------------------------------------------------------------
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('couriers')
      .update({
        status: 'terminated',
        availability: 'offline',
        is_active: false,
        is_online: false,
        available_for_orders: false,
        terminated_at: now,
      })
      .eq('id', driver.id);

    if (updateError) {
      logger.error('Failed to terminate driver', { error: updateError.message });
      return errorResponse(500, 'Failed to terminate driver', 'UPDATE_FAILED');
    }

    // -----------------------------------------------------------------------
    // 7. Permanently ban auth user (preserves courier record + history)
    // -----------------------------------------------------------------------
    if (driver.user_id) {
      // Ban permanently rather than delete to preserve referential integrity
      // (couriers.user_id has ON DELETE CASCADE which would destroy the record)
      const { error: banError } = await supabase.auth.admin.updateUserById(
        driver.user_id,
        { ban_duration: '876000h' }, // ~100 years
      );

      if (banError) {
        logger.error('Failed to ban auth user', { error: banError.message });
        // Non-fatal: driver record is already terminated
      } else {
        logger.info('Auth user permanently banned', { userId: driver.user_id });
      }
    }

    // -----------------------------------------------------------------------
    // 8. Log to driver_activity_log
    // -----------------------------------------------------------------------
    await supabase.from('driver_activity_log').insert({
      tenant_id: tenantId,
      driver_id: driver.id,
      event_type: 'terminated',
      event_data: {
        from: previousStatus,
        to: 'terminated',
        reason: input.reason,
        terminated_by_email: user.email,
      },
      created_by: user.id,
    });

    // -----------------------------------------------------------------------
    // 9. Success response
    // -----------------------------------------------------------------------
    logger.info('Driver terminated successfully', {
      driverId: driver.id,
      tenantId,
      previousStatus,
    });

    return new Response(
      JSON.stringify({ success: true }),
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
