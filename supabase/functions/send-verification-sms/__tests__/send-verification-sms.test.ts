/**
 * send-verification-sms Edge Function Tests
 *
 * Verifies:
 * 1. CORS handling
 * 2. Input validation with Zod
 * 3. Rate limiting (IP and phone-based)
 * 4. Phone-in-use check
 * 5. OTP generation and storage
 * 6. Twilio SMS integration
 * 7. Best-effort credit deduction with correct RPC params
 * 8. Dev mode OTP exposure
 * 9. Shared deps usage
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readEdgeFunctionSource(): string {
  const edgeFunctionPath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(edgeFunctionPath, 'utf-8');
}

describe('send-verification-sms', () => {
  const source = readEdgeFunctionSource();

  describe('shared deps usage', () => {
    it('should import serve, createClient, corsHeaders, z from shared deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts'");
    });

    it('should import CREDIT_ACTIONS from shared creditGate', () => {
      expect(source).toContain("import { CREDIT_ACTIONS } from '../_shared/creditGate.ts'");
    });

    it('should not import directly from deno.land or esm.sh', () => {
      // Imports should come from _shared/deps.ts only
      const lines = source.split('\n').filter(l => l.startsWith('import'));
      const directImports = lines.filter(l =>
        l.includes('deno.land') || l.includes('esm.sh')
      );
      expect(directImports).toHaveLength(0);
    });

    it('should not define its own corsHeaders', () => {
      expect(source).not.toMatch(/const\s+corsHeaders\s*=/);
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should return corsHeaders on OPTIONS response', () => {
      const optionsIdx = source.indexOf("req.method === 'OPTIONS'");
      const afterOptions = source.slice(optionsIdx, optionsIdx + 200);
      expect(afterOptions).toContain('corsHeaders');
    });

    it('should include corsHeaders in all JSON responses', () => {
      const jsonResponses = source.match(/headers:\s*\{[^}]*corsHeaders/g);
      expect(jsonResponses).not.toBeNull();
      expect(jsonResponses!.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('input validation', () => {
    it('should validate request with Zod schema', () => {
      expect(source).toContain('RequestSchema.safeParse(body)');
    });

    it('should require phoneNumber as string with min 10 chars', () => {
      expect(source).toContain("phoneNumber: z.string().min(10).max(15)");
    });

    it('should default countryCode to +1', () => {
      expect(source).toContain("countryCode: z.string().default('+1')");
    });

    it('should return 400 with error details on validation failure', () => {
      expect(source).toContain("{ error: 'Invalid request', details: parsed.error.issues }");
    });

    it('should NOT use complex type assertion for Zod errors', () => {
      // Zod safeParse returns proper types; no cast needed
      expect(source).not.toContain('parsed as {');
    });
  });

  describe('rate limiting', () => {
    it('should check IP-based rate limiting', () => {
      expect(source).toContain("eq('ip_address', clientIp)");
    });

    it('should check phone-based rate limiting', () => {
      expect(source).toContain("eq('phone_hash', phoneHash)");
    });

    it('should limit to 5 sends per IP per hour', () => {
      expect(source).toContain('MAX_SENDS_PER_IP = 5');
    });

    it('should limit to 3 attempts per phone per hour', () => {
      expect(source).toContain('MAX_ATTEMPTS_PER_PHONE = 3');
    });

    it('should return 429 when IP rate limit exceeded', () => {
      const ipCheckIdx = source.indexOf('ipSendCount');
      const afterCheck = source.slice(ipCheckIdx, ipCheckIdx + 500);
      expect(afterCheck).toContain('status: 429');
      expect(afterCheck).toContain('Too many verification requests');
    });

    it('should return 429 when phone rate limit exceeded', () => {
      const phoneCheckIdx = source.indexOf('phoneAttempts');
      const afterCheck = source.slice(phoneCheckIdx, phoneCheckIdx + 500);
      expect(afterCheck).toContain('status: 429');
      expect(afterCheck).toContain('too many times');
    });

    it('should use head:true for count-only queries', () => {
      const countQueries = [...source.matchAll(/count: 'exact', head: true/g)];
      expect(countQueries.length).toBe(2);
    });
  });

  describe('phone-in-use check', () => {
    it('should check if phone is already verified for another tenant', () => {
      expect(source).toContain("eq('phone_hash', phoneHash)");
      expect(source).toContain("eq('phone_verified', true)");
    });

    it('should return PHONE_IN_USE code when phone already associated', () => {
      expect(source).toContain("code: 'PHONE_IN_USE'");
    });
  });

  describe('OTP generation and storage', () => {
    it('should generate 6-digit OTP', () => {
      expect(source).toContain('OTP_LENGTH = 6');
    });

    it('should set 10-minute expiry', () => {
      expect(source).toContain('OTP_EXPIRY_MINUTES = 10');
    });

    it('should store verification record in phone_verifications table', () => {
      expect(source).toContain("from('phone_verifications')");
      expect(source).toContain('.insert(');
    });

    it('should store phone_number, phone_hash, verification_code, expires_at, ip_address', () => {
      expect(source).toContain('phone_number: fullPhoneNumber');
      expect(source).toContain('phone_hash: phoneHash');
      expect(source).toContain('verification_code: otp');
      expect(source).toContain('expires_at: expiresAt');
      expect(source).toContain('ip_address: clientIp');
    });
  });

  describe('Twilio integration', () => {
    it('should read Twilio environment variables', () => {
      expect(source).toContain("Deno.env.get('TWILIO_ACCOUNT_SID')");
      expect(source).toContain("Deno.env.get('TWILIO_AUTH_TOKEN')");
      expect(source).toContain("Deno.env.get('TWILIO_PHONE_NUMBER')");
    });

    it('should use Twilio Messages API endpoint', () => {
      expect(source).toContain('api.twilio.com/2010-04-01/Accounts/');
      expect(source).toContain('/Messages.json');
    });

    it('should use Basic auth for Twilio', () => {
      expect(source).toContain("'Authorization': 'Basic '");
    });

    it('should send SMS with FloraIQ branding', () => {
      expect(source).toContain('Your FloraIQ verification code is:');
    });

    it('should NOT use BigMike branding', () => {
      expect(source).not.toContain('BigMike');
    });

    it('should delete verification record on Twilio failure', () => {
      const twilioErrorIdx = source.indexOf('!twilioResponse.ok');
      expect(twilioErrorIdx).toBeGreaterThan(-1);
      const afterError = source.slice(twilioErrorIdx, twilioErrorIdx + 500);
      expect(afterError).toContain('.delete()');
      expect(afterError).toContain("eq('id', verification.id)");
    });

    it('should log OTP in dev mode instead of sending SMS', () => {
      expect(source).toContain('DEV MODE - OTP:');
    });

    it('should mask phone number in logs', () => {
      expect(source).toContain("fullPhoneNumber.slice(0, -4) + '****'");
    });
  });

  describe('best-effort credit deduction', () => {
    it('should define bestEffortCreditDeduction function', () => {
      expect(source).toContain('async function bestEffortCreditDeduction');
    });

    it('should skip credit deduction when no auth header present', () => {
      const fnIdx = source.indexOf('async function bestEffortCreditDeduction');
      const fnBody = source.slice(fnIdx, fnIdx + 1500);
      expect(fnBody).toContain("req.headers.get('Authorization')");
      expect(fnBody).toContain('if (!authHeader)');
    });

    it('should look up tenant from tenant_users', () => {
      expect(source).toContain("from('tenant_users')");
      expect(source).toContain("eq('user_id', user.id)");
    });

    it('should use .maybeSingle() for tenant lookup', () => {
      const fnIdx = source.indexOf('async function bestEffortCreditDeduction');
      const fnBody = source.slice(fnIdx, fnIdx + 1500);
      expect(fnBody).toContain('.maybeSingle()');
    });

    it('should check if tenant is free tier before deducting', () => {
      expect(source).toContain("select('is_free_tier')");
      expect(source).toContain('!tenant?.is_free_tier');
    });

    it('should use CREDIT_ACTIONS.SEND_SMS action key', () => {
      const fnIdx = source.indexOf('async function bestEffortCreditDeduction');
      const fnBody = source.slice(fnIdx, fnIdx + 1500);
      expect(fnBody).toContain('CREDIT_ACTIONS.SEND_SMS');
    });

    it('should use correct consume_credits RPC parameters', () => {
      const fnIdx = source.indexOf('async function bestEffortCreditDeduction');
      const fnBody = source.slice(fnIdx, fnIdx + 1500);
      expect(fnBody).toContain('p_tenant_id: tenantUser.tenant_id');
      expect(fnBody).toContain('p_action_key: CREDIT_ACTIONS.SEND_SMS');
      expect(fnBody).toContain('p_reference_id: verificationId');
      expect(fnBody).toContain("p_reference_type: 'phone_verification'");
      expect(fnBody).toContain("p_description: 'SMS verification code'");
    });

    it('should NOT pass p_amount (cost is determined by credit_costs table)', () => {
      const fnIdx = source.indexOf('async function bestEffortCreditDeduction');
      const fnBody = source.slice(fnIdx, fnIdx + 1500);
      expect(fnBody).not.toContain('p_amount');
    });

    it('should NOT pass p_metadata (not a valid RPC parameter)', () => {
      const fnIdx = source.indexOf('async function bestEffortCreditDeduction');
      const fnBody = source.slice(fnIdx, fnIdx + 1500);
      expect(fnBody).not.toContain('p_metadata');
    });

    it('should catch and log credit deduction errors without throwing', () => {
      const fnIdx = source.indexOf('async function bestEffortCreditDeduction');
      const fnEndIdx = source.indexOf('\n// Generate random OTP');
      const fnBody = source.slice(fnIdx, fnEndIdx);
      expect(fnBody).toContain('catch (err)');
      expect(fnBody).toContain('Credit deduction error (non-blocking)');
    });
  });

  describe('response format', () => {
    it('should return success:true with verificationId on success', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('verificationId: verification.id');
    });

    it('should return expiresIn in seconds', () => {
      expect(source).toContain('expiresIn: OTP_EXPIRY_MINUTES * 60');
    });

    it('should only expose devOtp in development environment', () => {
      expect(source).toContain("Deno.env.get('ENVIRONMENT') === 'development'");
      expect(source).toContain('devOtp: otp');
    });
  });

  describe('phone hashing', () => {
    it('should define hashPhone function', () => {
      expect(source).toContain('async function hashPhone');
    });

    it('should use SHA-256 for hashing', () => {
      expect(source).toContain("crypto.subtle.digest('SHA-256'");
    });

    it('should use PHONE_HASH_SALT environment variable', () => {
      expect(source).toContain("Deno.env.get('PHONE_HASH_SALT')");
    });
  });

  describe('error handling', () => {
    it('should catch and log top-level errors', () => {
      expect(source).toContain('[SEND_VERIFICATION_SMS] Error:');
    });

    it('should return 500 with generic message on unhandled errors', () => {
      expect(source).toContain("error: 'Failed to send verification code'");
    });
  });
});
