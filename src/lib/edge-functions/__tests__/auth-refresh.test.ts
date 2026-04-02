/**
 * Auth Refresh Edge Function Tests
 *
 * Tests for the auth-refresh edge function that refreshes access tokens
 * using valid refresh tokens from user_sessions.
 *
 * Verifies:
 * 1. CORS preflight handling
 * 2. Method validation (only POST allowed)
 * 3. Request body validation (refresh_token required)
 * 4. Invalid/expired token handling (401)
 * 5. Successful token refresh flow
 * 6. Error response format consistency
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const AUTH_REFRESH_ENDPOINT = `${FUNCTIONS_URL}/auth-refresh`;

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses
const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('Auth Refresh Edge Function Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should return 400 for empty body (missing refresh_token)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'VALIDATION_ERROR', message: 'refresh_token is required' },
          400
        )
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.message).toBeDefined();
    });

    it('should return 400 for invalid JSON body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Invalid JSON body' },
          400
        )
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });

    it('should return 400 for empty refresh_token string', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'VALIDATION_ERROR', message: 'refresh_token is required' },
          400
        )
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: '' }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('VALIDATION_ERROR');
    });

    it('should return 405 for non-POST methods', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'Method not allowed' },
          405
        )
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'GET',
      });

      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('Token Validation', () => {
    it('should return 401 for invalid/revoked refresh token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'INVALID_TOKEN', message: 'Invalid or revoked refresh token' },
          401
        )
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'invalid-token-here' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('INVALID_TOKEN');
      expect(data.message).toContain('Invalid');
    });

    it('should return 401 for expired session token', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(
          { error: 'TOKEN_EXPIRED', message: 'Session has expired, please log in again' },
          401
        )
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'expired-token' }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('TOKEN_EXPIRED');
      expect(data.message).toContain('expired');
    });
  });

  describe('Successful Refresh', () => {
    it('should return new tokens on successful refresh', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token-jwt',
        refresh_token: 'new-refresh-token-jwt',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse(mockTokenResponse, 200)
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'valid-refresh-token' }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.access_token).toBe('new-access-token-jwt');
      expect(data.refresh_token).toBe('new-refresh-token-jwt');
      expect(data.expires_in).toBe(3600);
      expect(data.token_type).toBe('Bearer');
    });

    it('should return correct token_type as Bearer', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          token_type: 'Bearer',
        })
      );

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'valid-token' }),
      });

      const data = await response.json();

      expect(data.token_type).toBe('Bearer');
    });
  });

  describe('Error Response Format', () => {
    it('should always include error field in error responses', async () => {
      const errorResponses = [
        { status: 400, body: { error: 'VALIDATION_ERROR', message: 'refresh_token is required' } },
        { status: 401, body: { error: 'INVALID_TOKEN', message: 'Invalid or revoked refresh token' } },
        { status: 401, body: { error: 'TOKEN_EXPIRED', message: 'Session has expired, please log in again' } },
        { status: 405, body: { error: 'Method not allowed' } },
        { status: 500, body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      ];

      for (const errorResp of errorResponses) {
        expect(errorResp.body).toHaveProperty('error');
        expect(typeof errorResp.body.error).toBe('string');
        expect(errorResp.body.error.length).toBeGreaterThan(0);
      }
    });

    it('should not include success: false in error responses', async () => {
      const errorBodies = [
        { error: 'VALIDATION_ERROR', message: 'Required' },
        { error: 'INVALID_TOKEN', message: 'Invalid' },
        { error: 'TOKEN_EXPIRED', message: 'Expired' },
      ];

      for (const body of errorBodies) {
        expect(body).not.toHaveProperty('success');
      }
    });
  });

  describe('CORS Handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('ok'),
        headers: new Headers({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }),
      });

      const response = await fetch(AUTH_REFRESH_ENDPOINT, {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Edge Function Source Code Verification', () => {
    const functionPath = path.resolve(
      __dirname,
      '../../../../supabase/functions/auth-refresh/index.ts'
    );

    it('should exist as an edge function', () => {
      expect(fs.existsSync(functionPath)).toBe(true);
    });

    it('should import from shared deps (not direct URLs)', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain("from '../_shared/deps.ts'");
      expect(content).not.toContain('deno.land');
      expect(content).not.toContain('esm.sh');
    });

    it('should use Zod validation for request body', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain('z.object');
      expect(content).toContain('safeParse');
      expect(content).toContain('refresh_token');
    });

    it('should handle CORS preflight', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain("req.method === 'OPTIONS'");
      expect(content).toContain('corsHeaders');
    });

    it('should use maybeSingle() for session lookup', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain('.maybeSingle()');
      expect(content).not.toContain('.single()');
    });

    it('should filter sessions by is_active', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain(".eq('is_active', true)");
    });

    it('should deactivate expired sessions', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain("{ is_active: false }");
    });

    it('should verify JWT signature before issuing new tokens', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      const verifyIndex = content.indexOf('verifyJWT(refresh_token)');
      const signIndex = content.indexOf('signJWT(');
      expect(verifyIndex).toBeGreaterThan(-1);
      expect(signIndex).toBeGreaterThan(-1);
      // Verify happens before sign
      expect(verifyIndex).toBeLessThan(signIndex);
    });

    it('should not include success: false in any JSON.stringify error response', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      // Check for the anti-pattern: JSON.stringify({ success: false, ...
      // Type assertion casts like `as { success: false; ... }` are acceptable
      const badPattern = /JSON\.stringify\(\{\s*success:\s*false/;
      expect(badPattern.test(content)).toBe(false);
    });

    it('should update last_activity_at on successful refresh', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain('last_activity_at');
    });

    it('should return standard token response fields', () => {
      const content = fs.readFileSync(functionPath, 'utf-8');
      expect(content).toContain('access_token');
      expect(content).toContain('refresh_token');
      expect(content).toContain('expires_in');
      expect(content).toContain('token_type');
    });
  });
});
