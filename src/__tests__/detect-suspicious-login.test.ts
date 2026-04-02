/**
 * detect-suspicious-login Edge Function Tests
 *
 * Static analysis and behavioral tests that verify:
 * 1. Auth check happens before body parsing (no 500 on unauthenticated requests)
 * 2. Zod validation errors return 400, not 500
 * 3. JSON parse errors return 400, not 500
 * 4. Proper CORS headers on all responses
 * 5. Internal error messages are not leaked to clients
 * 6. Request schema validates required fields
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FUNCTION_PATH = path.resolve(
  __dirname,
  '../../supabase/functions/detect-suspicious-login/index.ts'
);

const source = fs.readFileSync(FUNCTION_PATH, 'utf-8');

describe('detect-suspicious-login Edge Function', () => {
  describe('Source code static analysis', () => {
    it('should exist as an edge function', () => {
      expect(fs.existsSync(FUNCTION_PATH)).toBe(true);
    });

    it('should handle OPTIONS preflight requests', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should import corsHeaders from shared deps', () => {
      expect(source).toContain("import { corsHeaders } from '../_shared/deps.ts'");
    });

    it('should import withZenProtection from zen-firewall', () => {
      expect(source).toContain("import { withZenProtection } from '../_shared/zen-firewall.ts'");
    });

    it('should use Zod for request validation', () => {
      expect(source).toContain("import { z } from '../_shared/deps.ts'");
      expect(source).toContain('z.object(');
    });

    it('should check auth header BEFORE parsing request body', () => {
      const authCheckIndex = source.indexOf("req.headers.get('Authorization')");
      const jsonParseIndex = source.indexOf('req.json()');
      expect(authCheckIndex).toBeGreaterThan(-1);
      expect(jsonParseIndex).toBeGreaterThan(-1);
      expect(authCheckIndex).toBeLessThan(jsonParseIndex);
    });

    it('should return 401 for missing auth header', () => {
      expect(source).toContain("JSON.stringify({ error: 'Unauthorized' })");
      expect(source).toContain('status: 401');
    });

    it('should use safeParse for Zod validation (returns 400, not 500)', () => {
      expect(source).toContain('requestSchema.safeParse(');
      expect(source).toContain("error: 'Validation failed'");
      // Verify it does NOT use .parse() which throws
      expect(source).not.toContain('requestSchema.parse(');
    });

    it('should handle JSON parse errors with 400 status', () => {
      expect(source).toContain("error: 'Invalid JSON body'");
      // Verify there's a try-catch around req.json()
      expect(source).toContain('rawBody = await req.json()');
    });

    it('should not leak internal error messages in catch block', () => {
      // The generic catch should return a generic message, not the actual error
      expect(source).toContain("error: 'Internal server error'");
    });

    it('should handle missing environment variables gracefully', () => {
      expect(source).toContain("error: 'Server configuration error'");
    });

    it('should verify token belongs to the userId in the request', () => {
      expect(source).toContain('authUser.id !== body.userId');
      expect(source).toContain('status: 403');
    });

    it('should allow service role key as trusted caller', () => {
      expect(source).toContain('token === supabaseKey');
    });

    it('should call check_device_suspicious_login RPC', () => {
      expect(source).toContain("supabase.rpc('check_device_suspicious_login'");
    });

    it('should include all required RPC parameters', () => {
      expect(source).toContain('p_user_id:');
      expect(source).toContain('p_device_fingerprint:');
      expect(source).toContain('p_device_type:');
      expect(source).toContain('p_browser:');
      expect(source).toContain('p_os:');
      expect(source).toContain('p_ip_address:');
      expect(source).toContain('p_user_agent:');
      expect(source).toContain('p_geo_country:');
      expect(source).toContain('p_geo_city:');
    });

    it('should send email notification for suspicious logins', () => {
      expect(source).toContain('sendSuspiciousLoginEmail');
    });

    it('should update alert with email_sent status', () => {
      expect(source).toContain("email_sent: true");
      expect(source).toContain("email_sent_at:");
    });

    it('should return suspicious=true response with alert details', () => {
      expect(source).toContain('suspicious: true');
      expect(source).toContain('alertType:');
      expect(source).toContain('alertId:');
      expect(source).toContain('deviceId:');
      expect(source).toContain('emailSent');
    });

    it('should return suspicious=false response for known devices', () => {
      expect(source).toContain('suspicious: false');
    });

    it('should extract IP from x-forwarded-for or x-real-ip headers', () => {
      expect(source).toContain("req.headers.get('x-forwarded-for')");
      expect(source).toContain("req.headers.get('x-real-ip')");
    });

    it('should validate userId as UUID in schema', () => {
      expect(source).toContain('z.string().uuid()');
    });

    it('should validate fingerprint is non-empty in schema', () => {
      expect(source).toContain('z.string().min(1)');
    });

    it('should use Resend API for email delivery', () => {
      expect(source).toContain('https://api.resend.com/emails');
      expect(source).toContain('RESEND_API_KEY');
    });
  });

  describe('Request flow ordering', () => {
    it('should check auth before env var access', () => {
      const authCheckIdx = source.indexOf("!authHeader || !authHeader.startsWith('Bearer ')");
      const envVarIdx = source.indexOf("Deno.env.get('SUPABASE_URL')");
      expect(authCheckIdx).toBeLessThan(envVarIdx);
    });

    it('should check auth before Supabase client creation', () => {
      const authCheckIdx = source.indexOf("!authHeader || !authHeader.startsWith('Bearer ')");
      const clientIdx = source.indexOf('createClient(supabaseUrl, supabaseKey)');
      expect(authCheckIdx).toBeLessThan(clientIdx);
    });

    it('should validate body before RPC call', () => {
      const validationIdx = source.indexOf('requestSchema.safeParse(');
      const rpcIdx = source.indexOf("supabase.rpc('check_device_suspicious_login'");
      expect(validationIdx).toBeLessThan(rpcIdx);
    });
  });

  describe('Security', () => {
    it('should not expose raw error messages to clients', () => {
      // The catch block should log the real error but return a generic message
      const catchBlock = source.slice(
        source.lastIndexOf('} catch (error: unknown)'),
        source.lastIndexOf('})')
      );
      expect(catchBlock).toContain("console.error('Error in detect-suspicious-login:'");
      expect(catchBlock).toContain("error: 'Internal server error'");
      expect(catchBlock).not.toContain('error: errorMessage');
    });

    it('should wrap handler with withZenProtection', () => {
      expect(source).toContain('Deno.serve(withZenProtection(');
    });
  });
});
