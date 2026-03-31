/**
 * Background tasks that run after signup: email verification,
 * welcome email, analytics tracking, and onboarding workflow trigger.
 */

interface BackgroundTaskParams {
  supabaseKey: string;
  email: string;
  ownerName: string;
  businessName: string;
  tenantId: string;
  tenantSlug: string;
  tenantUserId: string;
  authUserId: string;
}

/**
 * Fire-and-forget background tasks after successful signup.
 * None of these block the signup response.
 */
export function runBackgroundTasks(
  supabase: unknown,
  params: BackgroundTaskParams
): void {
  const { supabaseKey, email, ownerName, businessName, tenantId, tenantSlug, tenantUserId, authUserId } = params;

  Promise.allSettled([
    // Send email verification link (hybrid approach: immediate access, 7-day deadline)
    sendVerificationEmail(supabase, supabaseKey, email, ownerName, businessName, tenantSlug, tenantUserId),

    // Send welcome email (if email service configured)
    sendWelcomeEmail(supabaseKey, email, ownerName, businessName, tenantSlug),

    // Track signup analytics event
    trackSignupAnalytics(tenantId, tenantSlug, email),

    // Trigger durable onboarding workflow on Vercel
    triggerOnboardingWorkflow(tenantId, authUserId, email, ownerName),
  ]).catch((error) => {
    console.warn('[SIGNUP] Background tasks error (non-blocking)', error);
  });
}

async function sendVerificationEmail(
  supabase: unknown,
  supabaseKey: string,
  email: string,
  ownerName: string,
  businessName: string,
  tenantSlug: string,
  tenantUserId: string
): Promise<void> {
  try {
    const sb = supabase as { auth: { admin: { generateLink: (opts: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; error: unknown }> } }; from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (col: string, val: string) => { catch: (fn: (err: unknown) => void) => void } } } };

    const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({
      type: 'signup',
      email: email.toLowerCase(),
      options: {
        redirectTo: `${Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || ''}/${tenantSlug}/admin/verify-email`,
      },
    });

    if (linkError || !linkData) {
      console.warn('[SIGNUP] Failed to generate verification link (non-blocking)', linkError);
      return;
    }

    // Update tenant_user record with verification sent timestamp
    await sb
      .from('tenant_users')
      .update({
        email_verification_sent_at: new Date().toISOString(),
      })
      .eq('id', tenantUserId)
      .catch((err: unknown) => {
        console.warn('[SIGNUP] Failed to update verification timestamp (non-blocking)', err);
      });

    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (resendApiKey) {
      const verificationLink = (linkData as Record<string, unknown>).properties
        ? ((linkData as Record<string, unknown>).properties as Record<string, unknown>).action_link as string
        : '';
      const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const emailUrl = `${siteUrl}/functions/v1/send-klaviyo-email`;
      await fetch(emailUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email.toLowerCase(),
          subject: `Verify your email — ${businessName}`,
          fromName: businessName,
          html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;"><h2 style="margin-top:0;">Verify your email address</h2><p>Hi ${ownerName},</p><p>Welcome to <strong>${businessName}</strong>! Please verify your email to secure your account. You have until <strong>${deadlineDate}</strong>.</p><p style="margin:30px 0;"><a href="${verificationLink}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;">Verify Email</a></p><p style="font-size:13px;color:#666;">Or paste this link in your browser:<br><a href="${verificationLink}" style="color:#16a34a;word-break:break-all;">${verificationLink}</a></p><hr style="border:none;border-top:1px solid #eee;margin:30px 0;"><p style="font-size:12px;color:#999;">If you didn't create this account, ignore this email.</p></body></html>`,
          text: `Hi ${ownerName},\n\nWelcome to ${businessName}! Verify your email by visiting:\n${verificationLink}\n\nYou have until ${deadlineDate} to verify.\n\nIf you didn't create this account, ignore this email.`,
        }),
      }).catch((err) => {
        console.warn('[SIGNUP] Verification email failed (non-blocking)', err);
      });
    } else {
      console.error('[SIGNUP] Verification email will be sent by Supabase Auth');
    }
  } catch (error) {
    console.warn('[SIGNUP] Email verification error (non-blocking)', error);
  }
}

async function sendWelcomeEmail(
  supabaseKey: string,
  email: string,
  ownerName: string,
  businessName: string,
  tenantSlug: string
): Promise<void> {
  try {
    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (resendApiKey) {
      const dashboardUrl = `${siteUrl}/${tenantSlug}/admin/dashboard`;
      const welcomeEmailUrl = `${siteUrl}/functions/v1/send-klaviyo-email`;
      await fetch(welcomeEmailUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email.toLowerCase(),
          subject: `Welcome to ${businessName}`,
          fromName: businessName,
          html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;"><h2 style="margin-top:0;">Welcome aboard, ${ownerName}!</h2><p>Your account for <strong>${businessName}</strong> is ready.</p><p style="margin:30px 0;"><a href="${dashboardUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:600;">Go to Dashboard</a></p><hr style="border:none;border-top:1px solid #eee;margin:30px 0;"><p style="font-size:12px;color:#999;">You're receiving this because you signed up at ${businessName}.</p></body></html>`,
          text: `Welcome aboard, ${ownerName}!\n\nYour account for ${businessName} is ready.\n\nGo to your dashboard: ${dashboardUrl}`,
        }),
      }).catch((err) => {
        console.warn('[SIGNUP] Welcome email failed (non-blocking)', err);
      });
    }
  } catch (error) {
    console.warn('[SIGNUP] Welcome email error (non-blocking)', error);
  }
}

async function trackSignupAnalytics(
  tenantId: string,
  tenantSlug: string,
  email: string
): Promise<void> {
  try {
    console.error('[SIGNUP] Analytics event: tenant_signup', {
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      email: email.toLowerCase(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('[SIGNUP] Analytics tracking error (non-blocking)', error);
  }
}

async function triggerOnboardingWorkflow(
  tenantId: string,
  authUserId: string,
  email: string,
  ownerName: string
): Promise<void> {
  await fetch(`${Deno.env.get('SITE_URL')}/api/workflows/start-onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': Deno.env.get('INTERNAL_API_KEY') || '',
    },
    body: JSON.stringify({
      tenantId,
      userId: authUserId,
      email,
      fullName: ownerName,
      trialDays: 14,
    }),
  }).catch(err => console.warn('[SIGNUP] Failed to start onboarding workflow:', err));
}
