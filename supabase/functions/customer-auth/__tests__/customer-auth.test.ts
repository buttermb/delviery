/**
 * customer-auth Edge Function — Source Analysis Tests
 *
 * Verifies all 7 actions: health, signup, login, verify, logout,
 * update-password, update-profile.
 *
 * Checks:
 * 1. CORS: All handlers use ctx.corsHeaders (origin-specific), not shared corsHeaders (wildcard)
 * 2. Security: brute force protection, JWT verification, password hashing, session fixation
 * 3. Validation: Zod schemas for all inputs
 * 4. Tenant isolation: tenant_id filtering on all queries
 * 5. Error handling: proper status codes and error messages
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(relativePath: string): string {
  const filePath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(filePath, 'utf-8');
}

describe('customer-auth Edge Function', () => {
  // ─── Router (index.ts) ───────────────────────────────────────────
  describe('router (index.ts)', () => {
    const source = readSource('index.ts');

    it('should import serve and createClient from shared deps', () => {
      expect(source).toContain("import { serve, createClient } from '../_shared/deps.ts'");
    });

    it('should NOT import corsHeaders from shared deps (uses origin-specific headers)', () => {
      // The router builds its own corsHeadersWithOrigin; it must NOT fall back to wildcard corsHeaders
      expect(source).not.toMatch(/import\s*\{[^}]*corsHeaders[^}]*\}\s*from\s*'\.\.\/\_shared\/deps\.ts'/);
    });

    it('should build origin-specific CORS headers (corsHeadersWithOrigin)', () => {
      expect(source).toContain('corsHeadersWithOrigin');
      expect(source).toContain("'Access-Control-Allow-Origin'");
      expect(source).toContain("'Access-Control-Allow-Credentials'");
    });

    it('should pass corsHeadersWithOrigin into HandlerContext', () => {
      expect(source).toContain('corsHeaders: corsHeadersWithOrigin');
    });

    it('should use corsHeadersWithOrigin in default (invalid action) response', () => {
      // The default case should spread corsHeadersWithOrigin, not the shared corsHeaders
      expect(source).toMatch(/default:[\s\S]*?"Invalid action"[\s\S]*?corsHeadersWithOrigin/);
    });

    it('should use corsHeadersWithOrigin in catch error response', () => {
      expect(source).toMatch(/catch\s*\(error\)[\s\S]*?corsHeadersWithOrigin/);
    });

    it('should handle OPTIONS preflight', () => {
      expect(source).toContain('req.method === "OPTIONS"');
    });

    it('should reject credentialed requests from non-allowed origins', () => {
      expect(source).toContain('hasCredentials && !requestOrigin');
      expect(source).toContain("'Origin not allowed'");
    });

    it('should route all 7 actions', () => {
      // health uses single quotes (early return), others use double quotes in switch
      expect(source).toContain("'health'");
      const switchActions = ['signup', 'login', 'verify', 'logout', 'update-password', 'update-profile'];
      for (const action of switchActions) {
        expect(source).toContain(`"${action}"`);
      }
    });

    it('should only parse body for signup and login actions', () => {
      expect(source).toContain("action === 'signup' || action === 'login'");
    });

    it('should use secureHeadersMiddleware', () => {
      expect(source).toContain('secureHeadersMiddleware');
    });

    describe('allowed origins', () => {
      it('should allow floraiqcrm.com', () => {
        expect(source).toContain("'https://floraiqcrm.com'");
        expect(source).toContain("'https://www.floraiqcrm.com'");
      });

      it('should allow localhost development', () => {
        expect(source).toContain("'http://localhost:8080'");
        expect(source).toContain("'http://localhost:5173'");
      });

      it('should allow Lovable preview domains via regex', () => {
        expect(source).toContain('lovableproject\\.com');
        expect(source).toContain('lovable\\.app');
      });
    });
  });

  // ─── Health Handler ──────────────────────────────────────────────
  describe('health handler', () => {
    const source = readSource('handlers/health.ts');

    it('should check required env vars', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_URL')");
      expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
      expect(source).toContain("Deno.env.get('JWT_SECRET')");
    });

    it('should return status ok with env check results', () => {
      expect(source).toContain("status: 'ok'");
      expect(source).toContain("function: 'customer-auth'");
    });

    it('should use ctx.corsHeaders for response', () => {
      expect(source).toContain('ctx.corsHeaders');
    });
  });

  // ─── Signup Handler ──────────────────────────────────────────────
  describe('signup handler', () => {
    const source = readSource('handlers/signup.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toContain("from '../../_shared/deps.ts'");
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('ctx.corsHeaders');
      // No wildcard corsHeaders usage
      expect(source).not.toMatch(/\{\s*\.\.\.corsHeaders\s*,/);
    });

    it('should validate input with signupSchema', () => {
      expect(source).toContain('signupSchema.safeParse(requestBody)');
    });

    it('should require either tenantSlug or tenantId', () => {
      expect(source).toContain('!tenantSlug && !tenantId');
    });

    it('should find tenant by slug or ID with active status', () => {
      expect(source).toContain('.eq("status", "active")');
      expect(source).toContain('.eq("slug", tenantSlug.toLowerCase())');
      expect(source).toContain('.eq("id", tenantId)');
    });

    it('should check for duplicate customer_users by email + tenant', () => {
      expect(source).toContain('.eq("email", email.toLowerCase())');
      expect(source).toContain('.eq("tenant_id", tenant.id)');
    });

    it('should cross-check tenant_users table for staff accounts', () => {
      expect(source).toContain("from('tenant_users')");
      expect(source).toContain("createServiceClient()");
    });

    it('should hash password before storing', () => {
      expect(source).toContain('hashPassword(password)');
      expect(source).toContain('password_hash: passwordHash');
    });

    it('should validate age if DOB provided', () => {
      expect(source).toContain('actualAge < minimumAge');
      expect(source).toContain('tenant.minimum_age || 21');
    });

    it('should require DOB when tenant requires age verification', () => {
      expect(source).toContain('tenant.age_verification_required');
      expect(source).toContain('"Date of birth is required for age verification"');
    });

    it('should send verification email asynchronously', () => {
      expect(source).toContain('send-verification-email');
      // Fire-and-forget pattern — catches errors but does not block
      expect(source).toContain('.catch(');
    });

    it('should set email_verified to false on creation', () => {
      expect(source).toContain('email_verified: false');
    });

    it('should return 201 on success with requires_verification flag', () => {
      expect(source).toContain('status: 201');
      expect(source).toContain('requires_verification: true');
    });

    it('should use .maybeSingle() for optional lookups', () => {
      const maybeSingleCount = (source.match(/\.maybeSingle\(\)/g) || []).length;
      expect(maybeSingleCount).toBeGreaterThanOrEqual(3); // tenant, existingUser, tenantUser
    });

    it('should use console.info (not console.error) for success messages', () => {
      expect(source).toContain("console.info('Customer signup successful:");
      expect(source).toContain("console.info('Marketplace profile created");
    });

    it('should return generic error for duplicate accounts (anti-enumeration)', () => {
      expect(source).toContain('AUTH_ERRORS.INVALID_CREDENTIALS');
    });

    it('should support business buyer signup', () => {
      expect(source).toContain('isBusinessBuyer');
      expect(source).toContain('businessName');
      expect(source).toContain('businessLicenseNumber');
      expect(source).toContain("marketplace_profiles");
    });
  });

  // ─── Login Handler ───────────────────────────────────────────────
  describe('login handler', () => {
    const source = readSource('handlers/login.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toContain("from '../../_shared/deps.ts'");
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('ctx.corsHeaders');
      expect(source).not.toMatch(/\{\s*\.\.\.corsHeaders\s*,/);
    });

    it('should validate input with loginSchema', () => {
      expect(source).toContain('loginSchema.safeParse(requestBody)');
    });

    it('should implement brute force protection', () => {
      expect(source).toContain('checkBruteForce(clientIP)');
      expect(source).toContain('bruteForceResult.blocked');
    });

    it('should extract client IP for brute force tracking', () => {
      expect(source).toContain('getClientIP(req)');
    });

    it('should log all auth events (success and failure)', () => {
      expect(source).toContain('logAuthEvent(');
      const logCalls = (source.match(/logAuthEvent\(/g) || []).length;
      expect(logCalls).toBeGreaterThanOrEqual(3); // blocked, not found, invalid pw, success
    });

    it('should find customer by email + tenant_id + active status', () => {
      expect(source).toContain('.eq("email", email.toLowerCase())');
      expect(source).toContain('.eq("tenant_id", tenant.id)');
      expect(source).toContain('.eq("is_active", true)');
    });

    it('should verify password with comparePassword', () => {
      expect(source).toContain('comparePassword(password, customerUser.password_hash)');
    });

    it('should check email verification before allowing login', () => {
      expect(source).toContain('customerUser.email_verified');
      expect(source).toContain('AUTH_ERRORS.EMAIL_NOT_VERIFIED');
    });

    it('should implement session fixation protection', () => {
      // Must invalidate previous sessions before creating new one
      expect(source).toContain("from('customer_sessions')");
      expect(source).toContain('.delete()');
      expect(source).toContain("eq('customer_user_id', customerUser.id)");
    });

    it('should create JWT token with createCustomerToken', () => {
      expect(source).toContain('createCustomerToken(');
      expect(source).toContain('customer_user_id: customerUser.id');
      expect(source).toContain("type: \"customer\"");
    });

    it('should create session record with 7-day expiry', () => {
      expect(source).toContain("from(\"customer_sessions\").insert(");
      expect(source).toContain('expiresAt.setDate(expiresAt.getDate() + 7)');
    });

    it('should return token, customer, tenant, and customerRecord', () => {
      expect(source).toContain('token,');
      expect(source).toContain('customer:');
      expect(source).toContain('tenant:');
      expect(source).toContain('customerRecord:');
    });

    it('should return generic error for invalid credentials (anti-enumeration)', () => {
      expect(source).toContain('GENERIC_AUTH_ERROR');
    });
  });

  // ─── Verify Handler ──────────────────────────────────────────────
  describe('verify handler', () => {
    const source = readSource('handlers/verify.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toContain("from '../../_shared/deps.ts'");
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('ctx.corsHeaders');
      expect(source).not.toMatch(/\{\s*\.\.\.corsHeaders\s*,/);
    });

    it('should require Authorization Bearer token', () => {
      expect(source).toContain('req.headers.get("Authorization")');
      expect(source).toContain('startsWith("Bearer ")');
    });

    it('should verify token with verifyCustomerToken', () => {
      expect(source).toContain('verifyCustomerToken(token)');
    });

    it('should check session exists and is not expired', () => {
      expect(source).toContain("from(\"customer_sessions\")");
      expect(source).toContain('.eq("token", token)');
      expect(source).toContain('.gt("expires_at"');
    });

    it('should verify customer_user is active', () => {
      expect(source).toContain('.eq("id", payload.customer_user_id)');
      expect(source).toContain('.eq("status", "active")');
    });

    it('should verify tenant is active', () => {
      expect(source).toContain('.eq("id", payload.tenant_id)');
      expect(source).toContain('.eq("status", "active")');
    });

    it('should return customer and tenant objects on success', () => {
      expect(source).toContain('customer:');
      expect(source).toContain('tenant:');
    });

    it('should use .maybeSingle() for all lookups', () => {
      const maybeSingleCount = (source.match(/\.maybeSingle\(\)/g) || []).length;
      expect(maybeSingleCount).toBeGreaterThanOrEqual(3); // session, customer, tenant
    });
  });

  // ─── Logout Handler ──────────────────────────────────────────────
  describe('logout handler', () => {
    const source = readSource('handlers/logout.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toContain("from '../../_shared/deps.ts'");
    });

    it('should use ctx.corsHeaders for response', () => {
      expect(source).toContain('ctx.corsHeaders');
      expect(source).not.toMatch(/\{\s*\.\.\.corsHeaders\s*,/);
    });

    it('should extract token from Authorization header', () => {
      expect(source).toContain('req.headers.get("Authorization")');
      expect(source).toContain('startsWith("Bearer ")');
    });

    it('should delete session record by token', () => {
      expect(source).toContain('.delete().eq("token", token)');
    });

    it('should always return success (graceful)', () => {
      expect(source).toContain('{ success: true }');
    });
  });

  // ─── Update Password Handler ─────────────────────────────────────
  describe('update-password handler', () => {
    const source = readSource('handlers/update-password.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toContain("from '../../_shared/deps.ts'");
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('ctx.corsHeaders');
      expect(source).not.toMatch(/\{\s*\.\.\.corsHeaders\s*,/);
    });

    it('should require Authorization Bearer token', () => {
      expect(source).toContain('req.headers.get("Authorization")');
      expect(source).toContain('"Authorization required"');
    });

    it('should validate input with updatePasswordSchema', () => {
      expect(source).toContain('updatePasswordSchema.safeParse(rawBody)');
    });

    it('should parse body from request (not ctx.requestBody)', () => {
      // update-password parses its own body
      expect(source).toContain('await req.json()');
    });

    it('should verify token with verifyCustomerToken', () => {
      expect(source).toContain('verifyCustomerToken(token)');
    });

    it('should check customer user is active', () => {
      expect(source).toContain('.eq("id", payload.customer_user_id)');
      expect(source).toContain('.eq("status", "active")');
    });

    it('should verify current password before updating', () => {
      expect(source).toContain('comparePassword(currentPassword, customerUser.password_hash)');
      expect(source).toContain('"Current password is incorrect"');
    });

    it('should hash new password with hashPassword', () => {
      expect(source).toContain('hashPassword(newPassword)');
    });

    it('should update password_hash in database', () => {
      expect(source).toContain('.update({ password_hash: newPasswordHash })');
    });
  });

  // ─── Update Profile Handler ──────────────────────────────────────
  describe('update-profile handler', () => {
    const source = readSource('handlers/update-profile.ts');

    it('should NOT import corsHeaders from shared deps', () => {
      expect(source).not.toContain("from '../../_shared/deps.ts'");
    });

    it('should use ctx.corsHeaders for all responses', () => {
      expect(source).toContain('ctx.corsHeaders');
      expect(source).not.toMatch(/\{\s*\.\.\.corsHeaders\s*,/);
    });

    it('should require Authorization Bearer token', () => {
      expect(source).toContain('req.headers.get("Authorization")');
      expect(source).toContain('"Authorization required"');
    });

    it('should validate input with updateProfileSchema', () => {
      expect(source).toContain('updateProfileSchema.safeParse(rawBody)');
    });

    it('should parse body from request (not ctx.requestBody)', () => {
      expect(source).toContain('await req.json()');
    });

    it('should verify token with verifyCustomerToken', () => {
      expect(source).toContain('verifyCustomerToken(token)');
    });

    it('should only update explicitly provided fields (no overwrite bug)', () => {
      // Must check for field presence before adding to update object
      expect(source).toContain("if ('firstName' in validated)");
      expect(source).toContain("if ('lastName' in validated)");
      expect(source).toContain("if ('phone' in validated)");
    });

    it('should filter update by customer_user_id AND tenant_id', () => {
      expect(source).toContain('.eq("id", payload.customer_user_id)');
      expect(source).toContain('.eq("tenant_id", payload.tenant_id)');
    });

    it('should set updated_at timestamp', () => {
      expect(source).toContain('updated_at:');
    });
  });

  // ─── Validation Schemas ──────────────────────────────────────────
  describe('validation schemas (validation.ts)', () => {
    const source = readSource('validation.ts');

    it('should import z from shared deps', () => {
      expect(source).toContain("import { z } from '../_shared/deps.ts'");
    });

    describe('signupSchema', () => {
      it('should validate email', () => {
        expect(source).toContain('z.string().email');
      });

      it('should enforce minimum password length of 8', () => {
        expect(source).toContain('.min(8');
      });

      it('should allow optional tenantSlug with slug format', () => {
        expect(source).toContain('/^[a-z0-9-]+$/');
      });

      it('should allow optional tenantId as UUID', () => {
        expect(source).toContain('.uuid(');
      });

      it('should support business buyer fields', () => {
        expect(source).toContain('isBusinessBuyer');
        expect(source).toContain('businessName');
        expect(source).toContain('businessLicenseNumber');
      });
    });

    describe('loginSchema', () => {
      it('should require tenantSlug', () => {
        expect(source).toMatch(/tenantSlug:\s*z\.string\(\)\.min\(1/);
      });
    });

    describe('updatePasswordSchema', () => {
      it('should require currentPassword', () => {
        expect(source).toContain('currentPassword: z.string().min(1');
      });

      it('should enforce min 8 chars for newPassword', () => {
        expect(source).toMatch(/newPassword:\s*z\.string\(\)\.min\(8/);
      });
    });

    describe('updateProfileSchema', () => {
      it('should make all fields optional', () => {
        // All fields should be optional — allowing partial updates
        expect(source).toMatch(/firstName:.*\.optional\(\)/);
        expect(source).toMatch(/lastName:.*\.optional\(\)/);
        expect(source).toMatch(/phone:.*\.optional\(\)/);
      });
    });

    it('should export TypeScript types for all schemas', () => {
      expect(source).toContain('export type SignupInput');
      expect(source).toContain('export type LoginInput');
      expect(source).toContain('export type UpdatePasswordInput');
      expect(source).toContain('export type UpdateProfileInput');
    });
  });

  // ─── Types & Token Utilities ─────────────────────────────────────
  describe('types and token utilities (handlers/types.ts)', () => {
    const source = readSource('handlers/types.ts');

    it('should define HandlerContext with corsHeaders field', () => {
      expect(source).toContain('corsHeaders: Record<string, string>');
    });

    it('should define CustomerJWTPayload with required fields', () => {
      expect(source).toContain('customer_user_id: string');
      expect(source).toContain('customer_id: string');
      expect(source).toContain('tenant_id: string');
      expect(source).toContain('type: "customer"');
    });

    it('should create tokens with 7-day expiry', () => {
      expect(source).toContain('7 * 24 * 60 * 60');
    });

    it('should verify token type is "customer"', () => {
      expect(source).toContain('payload.type !== "customer"');
    });

    it('should use signJWT and verifyJWT from shared jwt module', () => {
      expect(source).toContain("import { signJWT, verifyJWT as verifyJWTSecure } from '../../_shared/jwt.ts'");
    });
  });

  // ─── Cross-cutting Security Concerns ─────────────────────────────
  describe('security patterns', () => {
    it('should never use shared wildcard corsHeaders in any handler', () => {
      const handlers = [
        'handlers/signup.ts',
        'handlers/login.ts',
        'handlers/verify.ts',
        'handlers/logout.ts',
        'handlers/update-password.ts',
        'handlers/update-profile.ts',
      ];

      for (const handler of handlers) {
        const source = readSource(handler);
        // Must not import corsHeaders from shared deps
        expect(source).not.toContain("import { corsHeaders } from '../../_shared/deps.ts'");
        // Must not spread bare corsHeaders (only ctx.corsHeaders)
        const spreadMatches = source.match(/\.\.\.(corsHeaders)\b(?!WithOrigin)/g) || [];
        expect(spreadMatches.length).toBe(0);
      }
    });

    it('should use secure password hashing (not plain text)', () => {
      const signup = readSource('handlers/signup.ts');
      const updatePw = readSource('handlers/update-password.ts');
      expect(signup).toContain('hashPassword');
      expect(updatePw).toContain('hashPassword');
      expect(updatePw).toContain('comparePassword');
    });

    it('should use secure JWT (not base64 encoding)', () => {
      const types = readSource('handlers/types.ts');
      expect(types).toContain('signJWT');
      expect(types).toContain('verifyJWT');
    });

    it('should filter by tenant_id on all data queries', () => {
      const login = readSource('handlers/login.ts');
      const verify = readSource('handlers/verify.ts');
      const updateProfile = readSource('handlers/update-profile.ts');

      expect(login).toContain('.eq("tenant_id", tenant.id)');
      expect(verify).toContain('.eq("id", payload.tenant_id)');
      expect(updateProfile).toContain('.eq("tenant_id", payload.tenant_id)');
    });

    it('should use anti-enumeration error messages for auth failures', () => {
      const login = readSource('handlers/login.ts');
      const signup = readSource('handlers/signup.ts');

      // Login should use generic error for invalid credentials
      expect(login).toContain('GENERIC_AUTH_ERROR');
      // Signup should use generic error for duplicates
      expect(signup).toContain('AUTH_ERRORS.INVALID_CREDENTIALS');
    });
  });
});
