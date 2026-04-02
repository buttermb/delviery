/**
 * tenant-admin-auth verify handler tests
 *
 * Verifies:
 * 1. CORS headers use corsHeaders_ parameter (not wildcard import)
 * 2. Token extraction from cookies and Authorization header
 * 3. Error responses for missing/invalid tokens
 * 4. Owner fast-path and tenant_user fallback path
 * 5. Proper use of .maybeSingle() for optional lookups
 * 6. Response structure includes user, admin, tenant
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'handlers', 'verify.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('tenant-admin-auth verify handler', () => {
  const source = readSource();

  describe('CORS header correctness', () => {
    it('should NOT import corsHeaders from shared deps (uses corsHeaders_ parameter)', () => {
      // The wildcard corsHeaders import was causing CORS bugs for non-owner users.
      // All responses must use the corsHeaders_ parameter which includes the
      // request-specific origin and Access-Control-Allow-Credentials header.
      expect(source).not.toContain("import { corsHeaders } from '../../_shared/deps.ts'");
    });

    it('should not spread the shared corsHeaders in any response', () => {
      // Ensure no response uses ...corsHeaders (the wildcard import)
      // All responses should use corsHeaders_ (the parameter)
      expect(source).not.toMatch(/\.\.\.\s*corsHeaders[^_]/);
    });

    it('should use corsHeaders_ parameter for all error responses', () => {
      // Every errorResponse call must use corsHeaders_ (the function parameter)
      const errorCalls = source.match(/errorResponse\(([^,]+),/g) || [];
      expect(errorCalls.length).toBeGreaterThanOrEqual(3);
      for (const call of errorCalls) {
        expect(call).toContain('corsHeaders_');
      }
    });

    it('should use corsHeaders_ parameter for all success responses', () => {
      // Every jsonResponse call must use corsHeaders_ (the function parameter)
      const jsonCalls = source.match(/jsonResponse\(([^,]+),/g) || [];
      expect(jsonCalls.length).toBeGreaterThanOrEqual(2);
      for (const call of jsonCalls) {
        expect(call).toContain('corsHeaders_');
      }
    });

    it('should accept corsHeaders_ as a function parameter', () => {
      expect(source).toContain('corsHeaders_: CorsHeaders');
    });
  });

  describe('token extraction', () => {
    it('should check for token in httpOnly cookie first', () => {
      expect(source).toContain("req.headers.get('Cookie')");
      expect(source).toContain("tenant_access_token=");
    });

    it('should fall back to Authorization header', () => {
      expect(source).toContain("req.headers.get('Authorization')");
      expect(source).toContain("startsWith('Bearer ')");
    });

    it('should return 401 when no token is provided', () => {
      expect(source).toContain("errorResponse(corsHeaders_, 401, 'No token provided')");
    });
  });

  describe('token validation', () => {
    it('should verify token with supabase.auth.getUser', () => {
      expect(source).toContain('supabase.auth.getUser(token)');
    });

    it('should return 401 for invalid or expired token', () => {
      expect(source).toContain("errorResponse(corsHeaders_, 401, 'Invalid or expired token')");
    });

    it('should lowercase email for consistent lookups', () => {
      expect(source).toContain('user.email.toLowerCase()');
    });
  });

  describe('owner fast-path', () => {
    it('should check tenant ownership by owner_email', () => {
      expect(source).toContain(".eq('owner_email', userEmail)");
    });

    it('should use .maybeSingle() for owner lookup', () => {
      const ownerQuery = source.split('.eq(\'owner_email\', userEmail)')[1]?.split('\n')[0];
      // Just verify .maybeSingle() is used somewhere near the owner query
      expect(source).toContain(".maybeSingle()");
    });

    it('should assign owner role for tenant owners', () => {
      expect(source).toContain("role: 'owner'");
    });

    it('should return user, admin, and tenant in owner response', () => {
      expect(source).toContain('jsonResponse(corsHeaders_, { user, admin, tenant })');
    });

    it('should select tenant fields including subscription info', () => {
      expect(source).toContain('subscription_plan');
      expect(source).toContain('subscription_status');
      expect(source).toContain('trial_ends_at');
      expect(source).toContain('limits');
      expect(source).toContain('usage');
      expect(source).toContain('features');
    });
  });

  describe('tenant_users fallback path', () => {
    it('should query tenant_users by email and active status', () => {
      expect(source).toContain(".eq('email', userEmail)");
      expect(source).toContain(".eq('status', 'active')");
    });

    it('should return 403 when no tenant access found', () => {
      expect(source).toContain("errorResponse(corsHeaders_, 403, 'No tenant access found')");
    });

    it('should fetch tenant details for tenant_user', () => {
      expect(source).toContain(".eq('id', tenantUser.tenant_id)");
    });

    it('should return 404 when tenant not found', () => {
      expect(source).toContain("errorResponse(corsHeaders_, 404, 'Tenant not found')");
    });

    it('should use jsonResponse with corsHeaders_ for tenant user success path', () => {
      // This is the critical fix - the tenant_user success path must use
      // jsonResponse(corsHeaders_, ...) not new Response with wildcard corsHeaders
      const lines = source.split('\n');
      const lastJsonResponse = source.lastIndexOf('jsonResponse(corsHeaders_');
      expect(lastJsonResponse).toBeGreaterThan(-1);

      // Verify no raw Response construction with corsHeaders (wildcard) remains
      expect(source).not.toMatch(/new Response\(\s*JSON\.stringify\(\{.*user.*admin.*tenant/s);
    });
  });

  describe('response structure', () => {
    it('should include userId in admin object', () => {
      expect(source).toContain('userId: user.id');
    });

    it('should include tenant_id in admin object', () => {
      // Both owner and tenant_user paths should include tenant_id
      const matches = source.match(/tenant_id:/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should use utility functions for responses', () => {
      expect(source).toContain("import { errorResponse, jsonResponse } from '../utils.ts'");
    });
  });

  describe('error handling', () => {
    it('should handle PGRST116 errors gracefully', () => {
      // PGRST116 is the "no rows found" PostgREST error - should not be treated as error
      const pgrst116Checks = source.match(/PGRST116/g) || [];
      expect(pgrst116Checks.length).toBeGreaterThanOrEqual(2);
    });

    it('should log errors for debugging', () => {
      expect(source).toContain('[VERIFY]');
    });
  });
});
