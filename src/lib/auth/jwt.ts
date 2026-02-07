/**
 * JWT Utility Functions
 * For generating and verifying JWT tokens
 * 
 * Note: In production, use a proper JWT library like 'jose' or 'jsonwebtoken'
 * This is a simplified implementation for Edge Functions
 */

export interface JWTPayload {
  [key: string]: unknown;
  exp?: number;
  iat?: number;
}

/**
 * Encode JWT token (simplified - for Edge Functions only)
 * In production, use proper HMAC signing
 */
export function encodeJWT(payload: JWTPayload, secret: string, expiresIn: number = 7 * 24 * 60 * 60): string {
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
 */
export function verifyJWT(token: string, _secret: string): JWTPayload | null {
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
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
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

