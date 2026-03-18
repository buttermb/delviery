/**
 * JWT Utility Functions
 * For generating and verifying JWT tokens
 *
 * Note: In production, use a proper JWT library like 'jose' or 'jsonwebtoken'
 * This is a simplified implementation for Edge Functions
 */

import { logger } from '@/lib/logger';

export interface JWTPayload {
  [key: string]: unknown;
  exp?: number;
  iat?: number;
}

/**
 * Encode JWT token (simplified - for Edge Functions only)
 * In production, use proper HMAC signing
 * @deprecated Use Supabase Auth or a proper JWT library (jose/jsonwebtoken) instead. This simplified implementation lacks proper HMAC signing and is not secure for production use.
 */
export function encodeJWT(payload: JWTPayload, secret: string, expiresIn: number = 7 * 24 * 60 * 60): string {
  logger.error('[jwt] encodeJWT is deprecated — use Supabase Auth or a proper JWT library instead');

  const now = Math.floor(Date.now() / 1000);

  const jwtPayload: JWTPayload = {
    ...payload,
    exp: now + expiresIn,
    iat: now,
  };

  // Base64URL encoding
  const base64UrlEncode = (str: string): string => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));

  // In production, calculate proper HMAC signature
  // For now, create a simple signature (DO NOT USE IN PRODUCTION)
  const signature = base64UrlEncode(`${encodedHeader}.${encodedPayload}.${secret}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify JWT token (simplified - for Edge Functions only)
 * @deprecated Use Supabase Auth or a proper JWT library (jose/jsonwebtoken) instead. This simplified implementation does not verify signatures and is not secure for production use.
 */
export function verifyJWT(token: string, _secret: string): JWTPayload | null {
  logger.error('[jwt] verifyJWT is deprecated — use Supabase Auth or a proper JWT library instead');
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64URL decoding
    const base64UrlDecode = (str: string): string => {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      return atob(str);
    };

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    
    // Check expiration
    if (payload.exp != null && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // In production, verify HMAC signature properly
    // For now, just return payload if format is valid
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64UrlDecode = (str: string): string => {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      return atob(str);
    };

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
    
    return null;
  } catch {
    return null;
  }
}

