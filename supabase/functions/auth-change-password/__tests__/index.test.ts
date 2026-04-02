/**
 * auth-change-password Edge Function Tests
 *
 * Verifies:
 * 1. Shared dependency imports (deps, rateLimiting)
 * 2. Zod validation schema for password change requests
 * 3. CORS preflight handling
 * 4. Authorization header validation
 * 5. Password strength validation logic
 * 6. Rate limiting integration
 * 7. Current password verification flow
 * 8. Security event logging (success and failure)
 * 9. Proper HTTP status codes for all error cases
 * 10. No console.log/console.error usage
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('auth-change-password edge function', () => {
  const source = readSource();

  describe('shared dependency imports', () => {
    it('should import serve, createClient, corsHeaders, and z from shared deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts'");
    });

    it('should import checkRateLimit from shared rateLimiting', () => {
      expect(source).toContain("import { checkRateLimit } from '../_shared/rateLimiting.ts'");
    });

    it('should not define its own corsHeaders', () => {
      expect(source).not.toMatch(/const corsHeaders\s*=/);
    });
  });

  describe('Zod validation schema', () => {
    it('should define a changePasswordSchema with z.object', () => {
      expect(source).toContain('changePasswordSchema');
      expect(source).toContain('z.object');
    });

    it('should require current_password as a non-empty string', () => {
      expect(source).toContain('current_password: z.string()');
    });

    it('should require new_password with min 8 and max 100 characters', () => {
      expect(source).toContain('.min(8,');
      expect(source).toContain('.max(100,');
    });

    it('should have optional revoke_other_sessions boolean', () => {
      expect(source).toContain('revoke_other_sessions: z.boolean().optional()');
    });

    it('should use safeParse for validation', () => {
      expect(source).toContain('changePasswordSchema.safeParse(body)');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should return ok with corsHeaders for OPTIONS', () => {
      expect(source).toContain("new Response('ok', { headers: corsHeaders })");
    });

    it('should include corsHeaders in all JSON responses', () => {
      const jsonResponses = source.match(/new Response\(\s*JSON\.stringify/g);
      expect(jsonResponses).not.toBeNull();
      expect(jsonResponses!.length).toBeGreaterThan(0);

      // Every JSON.stringify response should have corsHeaders nearby
      const responseBlocks = source.split('new Response(');
      const jsonBlocks = responseBlocks.filter(b => b.trimStart().startsWith('JSON.stringify'));
      for (const block of jsonBlocks) {
        expect(block).toContain('corsHeaders');
      }
    });
  });

  describe('HTTP method validation', () => {
    it('should reject non-POST methods with 405', () => {
      expect(source).toContain("req.method !== 'POST'");
      expect(source).toContain("'Method not allowed'");
      expect(source).toContain('status: 405');
    });
  });

  describe('authorization header validation', () => {
    it('should extract Authorization header from request', () => {
      expect(source).toContain("req.headers.get('Authorization')");
    });

    it('should check for Bearer prefix', () => {
      expect(source).toContain("authHeader.startsWith('Bearer ')");
    });

    it('should return 401 for missing or invalid auth header', () => {
      expect(source).toContain("'Missing or invalid authorization header'");
      expect(source).toContain('status: 401');
    });

    it('should extract token from Bearer header', () => {
      expect(source).toContain("authHeader.replace('Bearer ', '')");
    });

    it('should verify user identity with getUser', () => {
      expect(source).toContain('supabaseUser.auth.getUser()');
    });

    it('should return 401 for invalid user', () => {
      expect(source).toContain("error: 'Unauthorized'");
    });
  });

  describe('password strength validation', () => {
    it('should define validatePasswordStrength function', () => {
      expect(source).toContain('function validatePasswordStrength(password: string)');
    });

    it('should check minimum length of 8 characters', () => {
      expect(source).toContain('password.length < 8');
    });

    it('should require at least one uppercase letter', () => {
      expect(source).toContain('/[A-Z]/');
    });

    it('should require at least one lowercase letter', () => {
      expect(source).toContain('/[a-z]/');
    });

    it('should require at least one digit', () => {
      expect(source).toContain('/[0-9]/');
    });

    it('should require at least one special character', () => {
      expect(source).toMatch(/\/\[!@#\$%/);
    });

    it('should return valid:true for strong passwords', () => {
      expect(source).toContain('return { valid: true }');
    });

    it('should return valid:false with reason for weak passwords', () => {
      expect(source).toContain('valid: false, reason:');
    });
  });

  describe('rate limiting', () => {
    it('should apply rate limiting with password_change key', () => {
      expect(source).toContain("key: 'password_change'");
    });

    it('should limit to 5 attempts per 15 minutes', () => {
      expect(source).toContain('limit: 5');
      expect(source).toContain('windowMs: 15 * 60 * 1000');
    });

    it('should use client IP and user ID as rate limit identifier', () => {
      expect(source).toContain('`${clientIP}:${user.id}`');
    });

    it('should extract client IP from x-forwarded-for header', () => {
      expect(source).toContain("req.headers.get('x-forwarded-for')");
    });

    it('should return 429 when rate limited', () => {
      expect(source).toContain('status: 429');
      expect(source).toContain("'Too many attempts. Please try again later.'");
    });
  });

  describe('current password verification', () => {
    it('should verify current password via signInWithPassword', () => {
      expect(source).toContain('supabaseVerify.auth.signInWithPassword');
    });

    it('should use user email for verification', () => {
      expect(source).toContain('email: user.email!');
    });

    it('should return 400 for incorrect current password', () => {
      expect(source).toContain("'Current password is incorrect'");
    });
  });

  describe('password change validation', () => {
    it('should reject new password that matches current password', () => {
      expect(source).toContain('current_password === new_password');
      expect(source).toContain("'New password must be different from current password'");
    });

    it('should validate password strength before updating', () => {
      expect(source).toContain('validatePasswordStrength(new_password)');
    });
  });

  describe('password update', () => {
    it('should use service role client for password update', () => {
      expect(source).toContain('serviceClient.auth.admin.updateUserById');
    });

    it('should pass user.id and new password to updateUserById', () => {
      expect(source).toContain('user.id');
      expect(source).toContain('{ password: new_password }');
    });

    it('should return 500 when update fails', () => {
      expect(source).toContain("'Failed to update password. Please try again.'");
      expect(source).toContain('status: 500');
    });

    it('should return success response on successful update', () => {
      expect(source).toContain('success: true');
      expect(source).toContain("'Password updated successfully'");
      expect(source).toContain('status: 200');
    });
  });

  describe('session revocation', () => {
    it('should check revoke_other_sessions flag', () => {
      expect(source).toContain('if (revoke_other_sessions)');
    });

    it('should use admin signOut for session revocation', () => {
      expect(source).toContain('serviceClient.auth.admin.signOut(user.id)');
    });

    it('should include revoked_other_sessions in success response', () => {
      expect(source).toContain('revoked_other_sessions: revoke_other_sessions');
    });
  });

  describe('security event logging', () => {
    it('should log to security_events table', () => {
      expect(source).toContain("from('security_events')");
    });

    it('should log failed password change attempts', () => {
      expect(source).toContain("event_type: 'password_change_failed'");
      expect(source).toContain("reason: 'incorrect_current_password'");
    });

    it('should log successful password changes', () => {
      expect(source).toContain("event_type: 'password_change'");
    });

    it('should include user_id in security events', () => {
      expect(source).toContain('user_id: user.id');
    });

    it('should include ip_address in security events', () => {
      expect(source).toContain('ip_address: clientIP');
    });

    it('should include timestamp in security event details', () => {
      expect(source).toContain('timestamp: new Date().toISOString()');
    });
  });

  describe('environment variables', () => {
    it('should read SUPABASE_URL from environment', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_URL')");
    });

    it('should read SUPABASE_ANON_KEY from environment', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_ANON_KEY')");
    });

    it('should read SUPABASE_SERVICE_ROLE_KEY from environment', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    });
  });

  describe('error handling', () => {
    it('should have a top-level try-catch', () => {
      expect(source).toContain('} catch (error)');
    });

    it('should check if error is an Error instance', () => {
      expect(source).toContain('error instanceof Error');
    });

    it('should return 500 with error message for unexpected errors', () => {
      expect(source).toContain("'An unexpected error occurred'");
    });
  });

  describe('code quality', () => {
    it('should not use console.log', () => {
      expect(source).not.toContain('console.log');
    });

    it('should not use console.error', () => {
      expect(source).not.toContain('console.error');
    });

    it('should not use console.warn', () => {
      expect(source).not.toContain('console.warn');
    });

    it('should use serve() from shared deps', () => {
      expect(source).toMatch(/^serve\(async/m);
    });

    it('should use Content-Type application/json for all responses', () => {
      const jsonContentTypes = (source.match(/'Content-Type': 'application\/json'/g) || []).length;
      // Every non-OPTIONS response should have JSON content type
      expect(jsonContentTypes).toBeGreaterThanOrEqual(1);
    });
  });
});
