/**
 * CAPTCHA verification for tenant signup using Cloudflare Turnstile.
 */

import { corsHeaders } from '../_shared/deps.ts';

interface CaptchaResult {
  passed: boolean;
  response?: Response;
}

/**
 * Verify CAPTCHA token if configured. Returns a response if verification fails,
 * or null if verification passes or is not required.
 */
export async function verifyCaptcha(
  captchaToken: string | undefined,
  email: string,
  clientIP: string
): Promise<CaptchaResult> {
  if (captchaToken) {
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (turnstileSecret) {
      try {
        const captchaVerification = await fetch(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: captchaToken,
              remoteip: clientIP,
            }),
          }
        );

        const captchaResult = await captchaVerification.json();

        if (!captchaResult.success) {
          console.warn('[SIGNUP] CAPTCHA verification failed', {
            email: email.toLowerCase(),
            errorCodes: captchaResult['error-codes'],
          });
          return {
            passed: false,
            response: new Response(
              JSON.stringify({ error: 'Security verification failed. Please try again.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            ),
          };
        }
      } catch (error) {
        console.error('[SIGNUP] CAPTCHA verification error', error);
        // Don't fail signup if CAPTCHA service is down, but log it
      }
    }
  } else {
    // CAPTCHA is required in production when TURNSTILE_SECRET_KEY is configured
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (turnstileSecret) {
      console.warn('[SIGNUP] CAPTCHA required but not provided', { email: email.toLowerCase(), clientIP });
      return {
        passed: false,
        response: new Response(
          JSON.stringify({
            error: 'Security verification required',
            message: 'Please complete the security verification to continue.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        ),
      };
    }
    // In development (no TURNSTILE_SECRET_KEY), allow signup without CAPTCHA
    console.error('[SIGNUP] No CAPTCHA token provided (development mode)', { email: email.toLowerCase() });
  }

  return { passed: true };
}
