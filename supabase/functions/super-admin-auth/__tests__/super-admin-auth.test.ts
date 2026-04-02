/**
 * super-admin-auth Edge Function Tests
 *
 * Verifies all 6 actions:
 * 1. health - liveness check
 * 2. login - authentication with rate limiting, password verification, session creation
 * 3. verify - token verification with blacklist check, session validation
 * 4. refresh - token refresh with session update
 * 5. update-password - password change with current password verification
 * 6. logout - token blacklisting and session deletion
 *
 * Also verifies:
 * - CORS headers use ctx.corsHeaders (not shared corsHeaders)
 * - JTI-based token blacklisting (not token substring)
 * - Hybrid auth logic correctness
 * - Input validation via Zod schemas
 * - Security patterns (rate limiting, failed attempt logging, timing-safe comparison)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(relativePath: string): string {
  const sourcePath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('super-admin-auth edge function', () => {
  // ============================================================================
  // Router (index.ts)
  // ============================================================================
  describe('router (index.ts)', () => {
    const source = readSource('index.ts');

    it('should register all 6 action handlers', () => {
      expect(source).toContain('health: handleHealth');
      expect(source).toContain('login: handleLogin');
      expect(source).toContain('verify: handleVerify');
      expect(source).toContain('refresh: handleRefresh');
      expect(source).toContain('"update-password": handleUpdatePassword');
      expect(source).toContain('logout: handleLogout');
    });

    it('should use secureHeadersMiddleware', () => {
      expect(source).toContain('secureHeadersMiddleware');
    });

    it('should NOT import corsHeaders from shared deps', () => {
      // After fix: only imports serve and createClient
      expect(source).not.toMatch(/import\s*\{[^}]*corsHeaders[^}]*\}\s*from\s*'\.\.\/\_shared\/deps\.ts'/);
    });

    it('should build origin-aware CORS headers (corsHeadersWithOrigin)', () => {
      expect(source).toContain('corsHeadersWithOrigin');
      expect(source).toContain("'Access-Control-Allow-Origin': requestOrigin || '*'");
    });

    it('should set Access-Control-Allow-Credentials for known origins', () => {
      expect(source).toContain("corsHeadersWithOrigin['Access-Control-Allow-Credentials'] = 'true'");
    });

    it('should reject credentials from non-allowed origins with 403', () => {
      expect(source).toContain('Origin not allowed');
      expect(source).toContain('status: 403');
    });

    it('should use corsHeadersWithOrigin for invalid action response', () => {
      expect(source).toContain('{ ...corsHeadersWithOrigin, "Content-Type": "application/json" }');
    });

    it('should use corsHeadersWithOrigin for error catch response', () => {
      // Both the invalid-action (400) and catch (500) should use corsHeadersWithOrigin
      const occurrences = (source.match(/corsHeadersWithOrigin/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(6); // Multiple uses throughout
    });

    it('should pass corsHeadersWithOrigin to handlers as corsHeaders', () => {
      expect(source).toContain('corsHeaders: corsHeadersWithOrigin');
    });

    it('should handle OPTIONS preflight', () => {
      expect(source).toContain("req.method === \"OPTIONS\"");
    });

    it('should parse POST body as JSON', () => {
      expect(source).toContain("req.method === \"POST\"");
      expect(source).toContain('JSON.parse(text)');
    });

    it('should allow health check without Supabase client', () => {
      expect(source).toContain('supabase: null as unknown');
    });

    describe('CORS origin allowlist', () => {
      it('should allow floraiqcrm.com production domains', () => {
        expect(source).toContain("'https://floraiqcrm.com'");
        expect(source).toContain("'https://www.floraiqcrm.com'");
      });

      it('should allow localhost development ports', () => {
        expect(source).toContain("'http://localhost:8080'");
        expect(source).toContain("'http://localhost:5173'");
      });

      it('should allow Lovable preview domains via regex', () => {
        expect(source).toContain('lovableproject\\.com');
        expect(source).toContain('lovable\\.app');
      });
    });
  });

  // ============================================================================
  // Health action
  // ============================================================================
  describe('health action', () => {
    const source = readSource('handlers/health.ts');

    it('should return status ok', () => {
      expect(source).toContain("status: 'ok'");
    });

    it('should return function name', () => {
      expect(source).toContain("function: 'super-admin-auth'");
    });

    it('should return timestamp', () => {
      expect(source).toContain('new Date().toISOString()');
    });

    it('should use ctx.corsHeaders', () => {
      expect(source).toContain('...ctx.corsHeaders');
      expect(source).not.toContain('...corsHeaders,');
    });
  });

  // ============================================================================
  // Login action
  // ============================================================================
  describe('login action', () => {
    const source = readSource('handlers/login.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toMatch(/import.*corsHeaders.*from.*deps/);
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('...ctx.corsHeaders');
      // Should NOT have any bare corsHeaders spread
      expect(source).not.toMatch(/\.\.\.corsHeaders[^W]/);
    });

    describe('input validation', () => {
      it('should validate with loginSchema (Zod)', () => {
        expect(source).toContain('loginSchema.safeParse(body)');
      });

      it('should return 400 on validation failure', () => {
        expect(source).toContain('"Validation failed"');
        expect(source).toContain('status: 400');
      });
    });

    describe('rate limiting', () => {
      it('should check rate limit via RPC', () => {
        expect(source).toContain('check_auth_rate_limit');
      });

      it('should return 429 when rate limited', () => {
        expect(source).toContain('status: 429');
      });

      it('should clear rate limit on successful login', () => {
        expect(source).toContain('clear_auth_rate_limit');
      });
    });

    describe('user lookup', () => {
      it('should query super_admin_users table', () => {
        expect(source).toContain('.from("super_admin_users")');
      });

      it('should filter by email and active status', () => {
        expect(source).toContain('.eq("email", email.toLowerCase())');
        expect(source).toContain('.eq("status", "active")');
      });

      it('should use .maybeSingle() for safe optional lookup', () => {
        expect(source).toContain('.maybeSingle()');
      });

      it('should log failed attempt for user not found', () => {
        expect(source).toContain("failure_reason: \"user_not_found\"");
      });

      it('should return generic INVALID_CREDENTIALS (prevent enumeration)', () => {
        expect(source).toContain('AUTH_ERRORS.INVALID_CREDENTIALS');
      });
    });

    describe('password verification', () => {
      it('should use comparePassword utility', () => {
        expect(source).toContain('comparePassword(');
      });

      it('should log failed attempt for invalid password', () => {
        expect(source).toContain("failure_reason: \"invalid_password\"");
      });

      it('should return 401 for invalid password', () => {
        // Multiple 401 responses for different auth failures
        const status401Count = (source.match(/status: 401/g) || []).length;
        expect(status401Count).toBeGreaterThanOrEqual(2);
      });
    });

    describe('session creation', () => {
      it('should create custom JWT via createSuperAdminToken', () => {
        expect(source).toContain('createSuperAdminToken');
      });

      it('should insert session in super_admin_sessions table', () => {
        expect(source).toContain('.from("super_admin_sessions").insert');
      });

      it('should set 8-hour session expiry', () => {
        expect(source).toContain('expiresAt.setHours(expiresAt.getHours() + 8)');
      });

      it('should track IP address and user agent in session', () => {
        expect(source).toContain('ip_address: sessionClientIp');
        expect(source).toContain('user_agent: sessionUserAgent');
      });

      it('should update last_login_at and last_login_ip', () => {
        expect(source).toContain('last_login_at:');
        expect(source).toContain('last_login_ip: clientIp');
      });
    });

    describe('hybrid auth (Phase 2)', () => {
      it('should check for existing Supabase auth user', () => {
        expect(source).toContain('supabase.auth.admin.listUsers');
      });

      it('should create new Supabase auth user if not exists', () => {
        expect(source).toContain('supabase.auth.admin.createUser');
      });

      it('should only generate session when createUser succeeds (not on error)', () => {
        // Fixed bug: session generation is inside !createError check
        expect(source).toContain('if (!createError && newAuthUser?.user)');
        // Should NOT have the old buggy pattern
        expect(source).not.toContain('if (createError) {\n        // Non-fatal error');
      });

      it('should include supabaseSession in response when available', () => {
        expect(source).toContain('response.supabaseSession = supabaseSession');
      });

      it('should catch hybrid auth errors without failing login', () => {
        expect(source).toContain('catch (_authError)');
      });
    });

    describe('response', () => {
      it('should return token and superAdmin user info', () => {
        expect(source).toContain('token,');
        expect(source).toContain('superAdmin: {');
        expect(source).toContain('email: superAdmin.email');
        expect(source).toContain('first_name: superAdmin.first_name');
        expect(source).toContain('last_name: superAdmin.last_name');
      });

      it('should return 200 on success', () => {
        expect(source).toContain('status: 200');
      });
    });
  });

  // ============================================================================
  // Verify action
  // ============================================================================
  describe('verify action', () => {
    const source = readSource('handlers/verify.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toMatch(/import.*corsHeaders.*from.*deps/);
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('...ctx.corsHeaders');
      expect(source).not.toMatch(/\.\.\.corsHeaders[^W]/);
    });

    describe('token extraction', () => {
      it('should extract Bearer token from Authorization header', () => {
        expect(source).toContain('req.headers.get("Authorization")');
        expect(source).toContain('authHeader.startsWith("Bearer ")');
      });

      it('should return 401 when no token provided', () => {
        expect(source).toContain('"No token provided"');
      });
    });

    describe('token verification', () => {
      it('should verify token via verifySuperAdminToken', () => {
        expect(source).toContain('verifySuperAdminToken(token)');
      });

      it('should return 401 for invalid/expired token', () => {
        expect(source).toContain('"Invalid or expired token"');
      });
    });

    describe('token blacklist check', () => {
      it('should check blacklist via is_token_blacklisted RPC', () => {
        expect(source).toContain('is_token_blacklisted');
      });

      it('should use payload.jti for blacklist check (not token substring)', () => {
        // Fixed bug: uses jti from JWT payload with fallback
        expect(source).toContain('payload.jti ?? token.substring(0, 32)');
      });

      it('should return 401 for revoked tokens', () => {
        expect(source).toContain('"Token has been revoked"');
      });
    });

    describe('session validation', () => {
      it('should check session in super_admin_sessions table', () => {
        expect(source).toContain('.from("super_admin_sessions")');
      });

      it('should verify session has not expired', () => {
        expect(source).toContain('.gt("expires_at"');
      });

      it('should use .maybeSingle() for session lookup', () => {
        expect(source).toContain('.maybeSingle()');
      });
    });

    describe('user validation', () => {
      it('should verify user is still active', () => {
        expect(source).toContain('.eq("status", "active")');
      });

      it('should return super admin user info on success', () => {
        expect(source).toContain('superAdmin: {');
        expect(source).toContain('id: superAdmin.id');
        expect(source).toContain('email: superAdmin.email');
        expect(source).toContain('role: superAdmin.role');
      });
    });
  });

  // ============================================================================
  // Refresh action
  // ============================================================================
  describe('refresh action', () => {
    const source = readSource('handlers/refresh.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toMatch(/import.*corsHeaders.*from.*deps/);
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('...ctx.corsHeaders');
      expect(source).not.toMatch(/\.\.\.corsHeaders[^W]/);
    });

    describe('input validation', () => {
      it('should validate with refreshSchema (Zod)', () => {
        expect(source).toContain('refreshSchema.safeParse(body)');
      });

      it('should return 400 on validation failure', () => {
        expect(source).toContain('"Validation failed"');
        expect(source).toContain('status: 400');
      });
    });

    describe('token verification', () => {
      it('should verify existing token', () => {
        expect(source).toContain('verifySuperAdminToken(token)');
      });

      it('should check token type is super_admin', () => {
        expect(source).toContain('payload.type !== "super_admin"');
      });

      it('should return 401 for invalid token', () => {
        expect(source).toContain('"Invalid token"');
        expect(source).toContain('status: 401');
      });
    });

    describe('token refresh', () => {
      it('should generate new token via createSuperAdminToken', () => {
        expect(source).toContain('createSuperAdminToken');
      });

      it('should update session with new token and 8-hour expiry', () => {
        expect(source).toContain('.from("super_admin_sessions")');
        expect(source).toContain('.update({');
        expect(source).toContain('token: newToken');
        expect(source).toContain('expiresAt.setHours(expiresAt.getHours() + 8)');
      });

      it('should match old token when updating session', () => {
        expect(source).toContain('.eq("token", token)');
      });

      it('should return new token on success', () => {
        expect(source).toContain('{ token: newToken }');
      });
    });
  });

  // ============================================================================
  // Update password action
  // ============================================================================
  describe('update-password action', () => {
    const source = readSource('handlers/update-password.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toMatch(/import.*corsHeaders.*from.*deps/);
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('...ctx.corsHeaders');
      expect(source).not.toMatch(/\.\.\.corsHeaders[^W]/);
    });

    describe('authorization', () => {
      it('should require Bearer token', () => {
        expect(source).toContain('req.headers.get("Authorization")');
        expect(source).toContain('"Authorization required"');
      });

      it('should verify token via verifySuperAdminToken', () => {
        expect(source).toContain('verifySuperAdminToken(token)');
      });

      it('should verify user is active', () => {
        expect(source).toContain('.eq("status", "active")');
      });
    });

    describe('input validation', () => {
      it('should validate with updatePasswordSchema (Zod)', () => {
        expect(source).toContain('updatePasswordSchema.safeParse(body)');
      });

      it('should return 400 on validation failure', () => {
        expect(source).toContain('"Validation failed"');
        expect(source).toContain('status: 400');
      });
    });

    describe('password change', () => {
      it('should verify current password with comparePassword', () => {
        expect(source).toContain('comparePassword(');
        expect(source).toContain('currentPassword');
      });

      it('should return 401 for incorrect current password', () => {
        expect(source).toContain('"Current password is incorrect"');
      });

      it('should hash new password with hashPassword', () => {
        expect(source).toContain('hashPassword(newPassword)');
      });

      it('should update password_hash in super_admin_users', () => {
        expect(source).toContain('.update({ password_hash: newPasswordHash })');
      });

      it('should return 500 on update failure', () => {
        expect(source).toContain('"Failed to update password"');
        expect(source).toContain('status: 500');
      });

      it('should return success message on completion', () => {
        expect(source).toContain('"Password updated successfully"');
        expect(source).toContain('success: true');
      });
    });
  });

  // ============================================================================
  // Logout action
  // ============================================================================
  describe('logout action', () => {
    const source = readSource('handlers/logout.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toMatch(/import.*corsHeaders.*from.*deps/);
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('...ctx.corsHeaders');
      expect(source).not.toMatch(/\.\.\.corsHeaders[^W]/);
    });

    describe('token blacklisting', () => {
      it('should extract Bearer token if present', () => {
        expect(source).toContain('authHeader.startsWith("Bearer ")');
      });

      it('should verify token to get payload', () => {
        expect(source).toContain('verifySuperAdminToken(token)');
      });

      it('should blacklist token via RPC', () => {
        expect(source).toContain('blacklist_token');
      });

      it('should use payload.jti for blacklist (not token substring)', () => {
        // Fixed bug: uses jti from JWT payload with fallback
        expect(source).toContain('payload.jti ?? token.substring(0, 32)');
      });

      it('should pass user ID and reason to blacklist RPC', () => {
        expect(source).toContain('p_user_id: payload.super_admin_id');
        expect(source).toContain('p_reason: "logout"');
      });
    });

    describe('session cleanup', () => {
      it('should delete session from super_admin_sessions', () => {
        expect(source).toContain('.from("super_admin_sessions").delete()');
      });

      it('should match by token when deleting session', () => {
        expect(source).toContain('.eq("token", token)');
      });
    });

    describe('response', () => {
      it('should always return success (even without token)', () => {
        expect(source).toContain('{ success: true }');
        expect(source).toContain('status: 200');
      });
    });
  });

  // ============================================================================
  // Utils
  // ============================================================================
  describe('utils', () => {
    const source = readSource('utils.ts');

    describe('SuperAdminJWTPayload type', () => {
      it('should include jti field for token blacklisting', () => {
        expect(source).toContain('jti?: string');
      });

      it('should include super_admin_id, role, and type', () => {
        expect(source).toContain('super_admin_id: string');
        expect(source).toContain('role: string');
        expect(source).toContain('type: "super_admin"');
      });
    });

    describe('createSuperAdminToken', () => {
      it('should set 8-hour expiry', () => {
        expect(source).toContain('8 * 60 * 60');
      });

      it('should use signJWT from shared jwt module', () => {
        expect(source).toContain('signJWT');
      });
    });

    describe('verifySuperAdminToken', () => {
      it('should reject non-super_admin token types', () => {
        expect(source).toContain('payload.type !== "super_admin"');
      });
    });

    describe('password hashing', () => {
      it('should use PBKDF2 with SHA-256', () => {
        expect(source).toContain('PBKDF2');
        expect(source).toContain('SHA-256');
      });

      it('should use 100000 iterations', () => {
        expect(source).toContain('iterations: 100000');
      });

      it('should generate random 16-byte salt', () => {
        expect(source).toContain('crypto.getRandomValues(new Uint8Array(16))');
      });

      it('should support legacy SHA-256 password format', () => {
        expect(source).toContain("hashValue.length === 64 && /^[a-f0-9]+$/i.test(hashValue)");
      });

      it('should use timing-safe comparison', () => {
        expect(source).toContain('timingSafeEqual');
      });
    });
  });

  // ============================================================================
  // Validation schemas
  // ============================================================================
  describe('validation schemas', () => {
    const source = readSource('validation.ts');

    it('should validate login email format', () => {
      expect(source).toContain('z.string().email(');
    });

    it('should enforce minimum password length of 8', () => {
      expect(source).toContain(".min(8, 'Password must be at least 8 characters')");
    });

    it('should enforce maximum password length of 100', () => {
      expect(source).toContain('.max(100)');
    });

    it('should require token for refresh', () => {
      expect(source).toContain("z.string().min(1, 'Token is required')");
    });

    it('should validate update password with current and new password', () => {
      expect(source).toContain('currentPassword:');
      expect(source).toContain('newPassword:');
    });

    it('should enforce new password minimum length of 8', () => {
      expect(source).toContain(".min(8, 'New password must be at least 8 characters')");
    });
  });

  // ============================================================================
  // Security patterns (cross-cutting)
  // ============================================================================
  describe('security patterns', () => {
    const loginSource = readSource('handlers/login.ts');
    const verifySource = readSource('handlers/verify.ts');
    const logoutSource = readSource('handlers/logout.ts');
    const indexSource = readSource('index.ts');

    it('should not leak user existence in login responses', () => {
      // Both user_not_found and invalid_password return same error
      const invalidCredCount = (loginSource.match(/AUTH_ERRORS\.INVALID_CREDENTIALS/g) || []).length;
      expect(invalidCredCount).toBe(2); // One for user_not_found, one for invalid_password
    });

    it('should log failed authentication attempts', () => {
      expect(loginSource).toContain('.from("auth_failed_attempts").insert');
    });

    it('should track client IP from X-Forwarded-For', () => {
      expect(loginSource).toContain('x-forwarded-for');
    });

    it('should use immediate token revocation via blacklist', () => {
      expect(verifySource).toContain('is_token_blacklisted');
      expect(logoutSource).toContain('blacklist_token');
    });

    it('should block credentials from unknown origins', () => {
      expect(indexSource).toContain('hasCredentials && !requestOrigin');
    });

    it('should no handler imports shared corsHeaders directly', () => {
      const handlers = ['login', 'verify', 'refresh', 'update-password', 'logout'];
      for (const handler of handlers) {
        const handlerSource = readSource(`handlers/${handler}.ts`);
        expect(handlerSource).not.toMatch(/import.*corsHeaders.*from.*deps/);
      }
    });
  });
});
