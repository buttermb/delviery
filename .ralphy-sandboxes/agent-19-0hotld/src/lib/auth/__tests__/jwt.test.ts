/**
 * JWT Utility Functions Tests
 * Security-focused tests for token handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTokenExpiration, encodeJWT, verifyJWT } from '../jwt';

describe('jwt utilities', () => {
  describe('getTokenExpiration', () => {
    it('should extract expiration from a valid JWT', () => {
      // Create a token expiring in 1 hour
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = { sub: 'user-123', exp };
      const base64Payload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.signature`;

      const expiration = getTokenExpiration(token);
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration?.getTime()).toBe(exp * 1000);
    });

    it('should return null for malformed tokens', () => {
      expect(getTokenExpiration('not-a-token')).toBeNull();
      expect(getTokenExpiration('')).toBeNull();
      expect(getTokenExpiration('a.b')).toBeNull(); // Only 2 parts
    });

    it('should return null for tokens without exp claim', () => {
      const payload = { sub: 'user-123' };
      const base64Payload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.signature`;

      expect(getTokenExpiration(token)).toBeNull();
    });

    it('should return null for tokens with invalid base64 payload', () => {
      const token = 'eyJhbGciOiJIUzI1NiJ9.!!!invalid!!!.signature';
      expect(getTokenExpiration(token)).toBeNull();
    });

    it('should handle tokens with padding characters', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = { exp };
      // Create without removing padding to test handling
      const base64Payload = btoa(JSON.stringify(payload));
      const base64UrlPayload = base64Payload
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      const token = `header.${base64UrlPayload}.signature`;

      const expiration = getTokenExpiration(token);
      expect(expiration).toBeInstanceOf(Date);
    });
  });

  describe('encodeJWT', () => {
    it('should create a token with three parts', () => {
      const token = encodeJWT({ sub: 'user-123' }, 'secret');
      const parts = token.split('.');
      expect(parts.length).toBe(3);
    });

    it('should include exp claim based on expiresIn', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = encodeJWT({ sub: 'user-123' }, 'secret', 3600);
      const afterTime = Math.floor(Date.now() / 1000);

      // Extract payload
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.exp).toBeGreaterThanOrEqual(beforeTime + 3600);
      expect(payload.exp).toBeLessThanOrEqual(afterTime + 3600);
    });

    it('should include iat claim', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = encodeJWT({ sub: 'user-123' }, 'secret');

      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.iat).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
    });

    it('should preserve custom claims', () => {
      const token = encodeJWT({ sub: 'user-123', role: 'admin', tenant_id: 'tenant-456' }, 'secret');

      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('admin');
      expect(payload.tenant_id).toBe('tenant-456');
    });

    // SECURITY TEST: Document the known vulnerability
    it('SECURITY WARNING: signature is NOT cryptographically secure', () => {
      // This test documents that the current implementation uses an insecure signature
      const token1 = encodeJWT({ sub: 'user-1' }, 'secret1');
      const token2 = encodeJWT({ sub: 'user-2' }, 'secret2');

      const sig1 = token1.split('.')[2];
      const sig2 = token2.split('.')[2];

      // Signatures should be different (they are, but not cryptographically)
      expect(sig1).not.toBe(sig2);

      // WARNING: The signature is just base64(header.payload.secret), NOT HMAC
      // This means tokens can be forged if any token is intercepted
    });
  });

  describe('verifyJWT', () => {
    it('should return payload for valid token format', () => {
      const token = encodeJWT({ sub: 'user-123', role: 'admin' }, 'secret');
      const payload = verifyJWT(token, 'secret');

      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user-123');
      expect(payload?.role).toBe('admin');
    });

    it('should return null for expired tokens', () => {
      // Create token that expired 1 hour ago
      const exp = Math.floor(Date.now() / 1000) - 3600;
      const payload = { sub: 'user-123', exp, iat: exp - 3600 };
      const base64Payload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      const token = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.signature`;

      expect(verifyJWT(token, 'secret')).toBeNull();
    });

    it('should return null for malformed tokens', () => {
      expect(verifyJWT('invalid', 'secret')).toBeNull();
      expect(verifyJWT('a.b', 'secret')).toBeNull();
      expect(verifyJWT('', 'secret')).toBeNull();
    });

    // SECURITY TEST: Document the known vulnerability
    it('SECURITY WARNING: does NOT verify signature', () => {
      // This test documents that signature verification is NOT implemented
      const token = encodeJWT({ sub: 'user-123' }, 'correct-secret');

      // Verification passes with ANY secret (vulnerability!)
      const payload = verifyJWT(token, 'wrong-secret');
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user-123');

      // WARNING: This is a critical security issue
      // The verifyJWT function should reject tokens with invalid signatures
    });

    // SECURITY TEST: Document forgeability
    it('SECURITY WARNING: tokens can be forged without secret', () => {
      // An attacker can create any payload and it will be accepted
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const forgedPayload = {
        sub: 'admin-user',
        role: 'super_admin',
        tenant_id: 'any-tenant',
        exp,
        iat: exp - 3600
      };
      const base64Payload = btoa(JSON.stringify(forgedPayload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // Fake signature - doesn't matter what it is
      const forgedToken = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.forged_signature`;

      // This should FAIL but currently PASSES (vulnerability!)
      const result = verifyJWT(forgedToken, 'any-secret');
      expect(result).not.toBeNull();
      expect(result?.role).toBe('super_admin');

      // WARNING: In production, only use Supabase's verified tokens
    });
  });
});

describe('token expiration edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should correctly identify tokens expiring soon', () => {
    // Set current time
    const now = new Date('2026-01-21T12:00:00Z');
    vi.setSystemTime(now);

    // Token expires in 5 minutes
    const exp = Math.floor(now.getTime() / 1000) + 300;
    const payload = { sub: 'user-123', exp };
    const base64Payload = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const token = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.signature`;

    const expiration = getTokenExpiration(token);
    expect(expiration).not.toBeNull();

    // Check it's 5 minutes from "now"
    const timeUntilExpiry = expiration!.getTime() - now.getTime();
    expect(timeUntilExpiry).toBe(300 * 1000); // 5 minutes in ms
  });

  it('should handle tokens at exact expiration boundary', () => {
    const now = new Date('2026-01-21T12:00:00Z');
    vi.setSystemTime(now);

    // Token expired 1 second ago (past the boundary)
    const exp = Math.floor(now.getTime() / 1000) - 1;
    const payload = { sub: 'user-123', exp };
    const base64Payload = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const token = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.signature`;

    // verifyJWT should return null for expired tokens
    expect(verifyJWT(token, 'secret')).toBeNull();
  });
});
