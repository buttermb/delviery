import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ---------------------------------------------------------------------------
// Inlined shared deps
// ---------------------------------------------------------------------------

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

// Password hashing (PBKDF2 via Web Crypto API)
const ITERATIONS = 310000;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_LENGTH * 8,
  );
  return new Uint8Array(derivedBits);
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) binary += String.fromCharCode(buffer[i]);
  return btoa(binary);
}

async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  return `${arrayBufferToBase64(salt)}:${arrayBufferToBase64(hash)}`;
}

const logger = createLogger('add-driver');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const addDriverSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  display_name: z.string().max(100).optional(),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 characters').max(20),
  notes: z.string().max(2000).optional(),
  vehicle_type: z.enum(['car', 'van', 'motorcycle', 'bicycle', 'truck']),
  vehicle_make: z.string().min(1, 'Vehicle make is required').max(50),
  vehicle_model: z.string().min(1, 'Vehicle model is required').max(50),
  vehicle_year: z.number().int().min(1990).max(2030),
  vehicle_color: z.string().min(1, 'Vehicle color is required').max(30),
  vehicle_plate: z.string().min(1, 'Vehicle plate is required').max(20),
  commission_rate: z.number().min(0).max(100).default(30),
  zone_id: z.string().uuid().optional(),
  send_invite_email: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function errorResponse(
  status: number,
  error: string,
  code: string,
  details?: Record<string, string[]>,
) {
  return new Response(
    JSON.stringify({ success: false, error, code, ...(details ? { details } : {}) }),
    { status, headers: jsonHeaders },
  );
}

function generatePin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, '0');
}

function generateTempPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
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
      logger.warn('Non-admin attempted to add driver', { userId: user.id });
      return errorResponse(403, 'Admin access required', 'FORBIDDEN');
    }

    const tenantId = tenantUser.tenant_id;

    // -----------------------------------------------------------------------
    // 4. Validate request body
    // -----------------------------------------------------------------------
    const rawBody = await req.json();
    const validation = addDriverSchema.safeParse(rawBody);

    if (!validation.success) {
      const fieldErrors = (validation as z.SafeParseError<typeof addDriverSchema>).error.flatten().fieldErrors as Record<string, string[]>;
      logger.warn('Validation failed', { errors: fieldErrors });
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', fieldErrors);
    }

    const input = validation.data;

    // -----------------------------------------------------------------------
    // 5. Check for duplicate email
    // -----------------------------------------------------------------------
    const { data: existingCourier } = await supabase
      .from('couriers')
      .select('id')
      .eq('email', input.email)
      .maybeSingle();

    if (existingCourier) {
      logger.warn('Email already exists in couriers', { email: input.email });
      return errorResponse(409, 'A driver with this email already exists', 'EMAIL_EXISTS');
    }

    // -----------------------------------------------------------------------
    // 6. Create auth user (or reuse existing)
    // -----------------------------------------------------------------------
    const tempPassword = generateTempPassword();
    let authUserId: string;
    let isExistingUser = false;

    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: input.full_name,
        phone: input.phone,
        role: 'driver',
      },
    });

    if (createUserError) {
      // If user already exists in auth, look them up and reuse
      if (createUserError.message?.includes('already been registered')) {
        logger.info('Email exists in auth, linking existing user as driver', { email: input.email });
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingUser = listData?.users?.find((u: any) => u.email === input.email);
        if (!existingUser) {
          logger.error('Could not find existing user by email', { email: input.email });
          return errorResponse(500, 'Failed to locate existing account', 'AUTH_LOOKUP_FAILED');
        }
        authUserId = existingUser.id;
        isExistingUser = true;
      } else {
        logger.error('Failed to create auth user', { error: createUserError.message });
        return errorResponse(500, 'Failed to create driver account', 'AUTH_CREATE_FAILED');
      }
    } else {
      authUserId = authData.user.id;
    }

    // -----------------------------------------------------------------------
    // 7. Generate and hash 6-digit PIN
    // -----------------------------------------------------------------------
    const pin = generatePin();
    const pinHash = await hashPassword(pin);

    // -----------------------------------------------------------------------
    // 8. Insert courier record
    // -----------------------------------------------------------------------
    const { data: driver, error: insertError } = await supabase
      .from('couriers')
      .insert({
        user_id: authUserId,
        tenant_id: tenantId,
        full_name: input.full_name,
        display_name: input.display_name || null,
        email: input.email,
        phone: input.phone,
        license_number: 'PENDING',
        vehicle_type: input.vehicle_type,
        vehicle_make: input.vehicle_make,
        vehicle_model: input.vehicle_model,
        vehicle_year: input.vehicle_year,
        vehicle_color: input.vehicle_color,
        vehicle_plate: input.vehicle_plate,
        commission_rate: input.commission_rate,
        zone_id: input.zone_id || null,
        notes: input.notes || null,
        status: 'pending',
        availability: 'offline',
        is_active: true,
        is_online: false,
        pin_hash: pinHash,
      })
      .select('id')
      .single();

    if (insertError) {
      logger.error('Failed to insert courier record', { error: insertError.message });
      // Rollback: only delete auth user if we just created it
      if (!isExistingUser) {
        await supabase.auth.admin.deleteUser(authUserId);
      }
      return errorResponse(500, 'Failed to create driver record', 'INSERT_FAILED');
    }

    // -----------------------------------------------------------------------
    // 9. Store PIN hash (in a metadata column or separate table)
    //    Using the notes approach for now — store in user_metadata
    // -----------------------------------------------------------------------
    await supabase.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        full_name: input.full_name,
        phone: input.phone,
        role: 'driver',
        pin_hash: pinHash,
      },
    });

    // -----------------------------------------------------------------------
    // 10. Log to driver_activity_log
    // -----------------------------------------------------------------------
    await supabase.from('driver_activity_log').insert({
      tenant_id: tenantId,
      driver_id: driver.id,
      event_type: 'account_created',
      event_data: {
        created_by_email: user.email,
        vehicle: `${input.vehicle_year} ${input.vehicle_make} ${input.vehicle_model}`,
        commission_rate: input.commission_rate,
        zone_id: input.zone_id || null,
        invite_sent: input.send_invite_email,
      },
      created_by: user.id,
    });

    // -----------------------------------------------------------------------
    // 11. Send invite email via Resend (if requested)
    // -----------------------------------------------------------------------
    let emailSent = false;

    if (input.send_invite_email) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const portalUrl = Deno.env.get('COURIER_PORTAL_URL') || 'https://floraiq.app/courier';

      if (resendApiKey) {
        try {
          const emailHtml = `
            <div style="font-family: Inter, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
              <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Welcome to FloraIQ</h1>
              <p style="color: #6b7280; margin-bottom: 32px;">Your driver account has been created. Use the credentials below to log in.</p>

              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0;"><strong>Portal:</strong> <a href="${portalUrl}" style="color: #10b981;">${portalUrl}</a></p>
                <p style="margin: 0 0 12px 0;"><strong>Email:</strong> ${input.email}</p>
                <p style="margin: 0 0 12px 0;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${tempPassword}</code></p>
                <p style="margin: 0;"><strong>PIN:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${pin}</code></p>
              </div>

              <p style="color: #ef4444; font-size: 13px; margin-bottom: 24px;">Please change your password after your first login. Your PIN is required for order verification.</p>

              <a href="${portalUrl}" style="display: inline-block; background: #10b981; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">Open Courier Portal</a>

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
              to: [input.email],
              subject: 'Your FloraIQ Driver Account',
              html: emailHtml,
            }),
          });

          if (resendResponse.ok) {
            emailSent = true;
            logger.info('Invite email sent', { email: input.email });
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
        logger.warn('RESEND_API_KEY not configured, skipping invite email');
      }
    }

    // -----------------------------------------------------------------------
    // 12. Success response
    // -----------------------------------------------------------------------
    logger.info('Driver created successfully', {
      driverId: driver.id,
      tenantId,
      emailSent: String(emailSent),
    });

    return new Response(
      JSON.stringify({
        success: true,
        driver_id: driver.id,
        pin,
        email_sent: emailSent,
      }),
      { status: 201, headers: jsonHeaders },
    );
  } catch (error) {
    logger.error('Unexpected error', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(500, 'Internal server error', 'INTERNAL_ERROR');
  }
});
