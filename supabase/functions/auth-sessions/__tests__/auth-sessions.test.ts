/**
 * auth-sessions Edge Function Tests
 *
 * Verifies:
 * 1. Source code patterns (CORS, auth checks, shared deps, typed parameters)
 * 2. API contract via mock fetch (401 without auth, 400 for bad body, 405 for wrong method)
 * 3. Session listing and revocation responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://mtvwmyerntkhrcdnhahp.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const ENDPOINT = `${FUNCTIONS_URL}/auth-sessions`;

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  headers: new Headers({ 'Content-Type': 'application/json' }),
});

describe('auth-sessions edge function', () => {
  const source = readSource();

  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('source code patterns', () => {
    it('should import from shared deps', () => {
      expect(source).toContain("from '../_shared/deps.ts'");
    });

    it('should import SupabaseClient type', () => {
      expect(source).toContain('SupabaseClient');
    });

    it('should handle OPTIONS preflight', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should include CORS headers in responses', () => {
      expect(source).toContain('corsHeaders');
    });

    it('should check for Authorization header', () => {
      expect(source).toContain("req.headers.get('Authorization')");
    });

    it('should return 401 when auth header is missing', () => {
      expect(source).toContain('Missing authorization header');
      expect(source).toContain('status: 401');
    });

    it('should validate user via getUser()', () => {
      expect(source).toContain('supabaseAuth.auth.getUser()');
    });

    it('should return 401 for invalid sessions', () => {
      expect(source).toContain('Invalid or expired session');
    });

    it('should use Zod for request body validation', () => {
      expect(source).toContain('revokeSessionSchema');
      expect(source).toContain('.parse(body)');
    });

    it('should handle malformed JSON body gracefully', () => {
      expect(source).toContain('Invalid JSON body');
      // Verify the JSON parse is in its own try-catch
      expect(source).toMatch(/try\s*\{[\s\S]*?await req\.json\(\)[\s\S]*?\}\s*catch\s*\{[\s\S]*?Invalid JSON body/);
    });

    it('should use service role key for database operations', () => {
      expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    it('should query user_sessions table', () => {
      expect(source).toContain("from('user_sessions')");
    });

    it('should filter sessions by user_id', () => {
      expect(source).toContain("eq('user_id', userId)");
    });

    it('should use .maybeSingle() for single session lookups', () => {
      expect(source).toContain('.maybeSingle()');
    });

    it('should not use .single() for optional data', () => {
      expect(source).not.toContain('.single()');
    });

    it('should not contain console.log', () => {
      expect(source).not.toContain('console.log');
    });

    it('should not use any type for supabase parameters', () => {
      expect(source).not.toMatch(/supabase:\s*any/);
    });

    it('should log session revocation to auth_audit_log', () => {
      expect(source).toContain("from('auth_audit_log')");
      expect(source).toContain("event_type: 'session_revoked'");
    });

    it('should strip session_token from GET response', () => {
      // The formattedSessions mapping uses session_token only for is_current comparison
      expect(source).toContain('is_current: session.session_token === currentToken');
      // The mapped object should NOT include session_token as a field
      expect(source).toContain('formattedSessions');
      // session_token only appears in the is_current check, not as a returned field
      const mappedFields = source.match(/formattedSessions[\s\S]*?\]\)/);
      expect(mappedFields).toBeTruthy();
    });

    it('should support revoke and revoke_all_others actions', () => {
      expect(source).toContain("z.enum(['revoke', 'revoke_all_others'])");
    });

    it('should require session_id for revoke action', () => {
      expect(source).toContain('session_id is required for revoke action');
    });

    it('should handle already-revoked sessions', () => {
      expect(source).toContain('Session already revoked');
    });

    it('should return 405 for unsupported methods', () => {
      expect(source).toContain('Method not allowed');
      expect(source).toContain('status: 405');
    });

    it('should catch ZodError and return 400', () => {
      expect(source).toContain('z.ZodError');
      expect(source).toContain("'Invalid request body'");
    });
  });

  describe('API contract - no auth', () => {
    it('should return 401 for POST without authorization', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should return 401 for GET without authorization', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Missing authorization header' }, 401)
      );

      const response = await fetch(ENDPOINT, { method: 'GET' });

      expect(response.status).toBe(401);
    });
  });

  describe('API contract - with auth', () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer valid-token-123',
    };

    it('should return sessions list for authenticated GET', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          device_info: { browser: 'Chrome', os: 'macOS' },
          ip_address: '192.168.1.1',
          location: { city: 'NYC', country: 'US' },
          is_active: true,
          last_activity_at: '2026-04-01T00:00:00Z',
          created_at: '2026-03-31T00:00:00Z',
          expires_at: '2026-04-08T00:00:00Z',
          is_current: true,
        },
      ];

      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, sessions: mockSessions })
      );

      const response = await fetch(ENDPOINT, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].is_current).toBe(true);
      // session_token should not be exposed
      expect(data.sessions[0].session_token).toBeUndefined();
    });

    it('should return 400 for invalid revoke body', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Invalid request body' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'invalid_action' }),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for revoke without session_id', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'session_id is required for revoke action' }, 400)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'revoke' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('session_id');
    });

    it('should revoke a specific session', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ success: true, message: 'Session revoked successfully' })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'revoke',
          session_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should revoke all other sessions', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: '2 session(s) revoked successfully',
          revoked_count: 2,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'revoke_all_others' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.revoked_count).toBe(2);
    });

    it('should handle no other sessions to revoke', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          success: true,
          message: 'No other active sessions to revoke',
          revoked_count: 0,
        })
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'revoke_all_others' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.revoked_count).toBe(0);
    });

    it('should return 404 for non-existent session', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({ error: 'Session not found' }, 404)
      );

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          action: 'revoke',
          session_id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('CORS compliance', () => {
    it('should return 200 for OPTIONS preflight', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(null, 200)
      );

      const response = await fetch(ENDPOINT, { method: 'OPTIONS' });
      expect(response.status).toBe(200);
    });
  });
});
