/**
 * Secure JWT utilities using Web Crypto API
 * Implements proper HMAC-SHA256 signing for edge functions
 */

// Validate JWT_SECRET is set
function getJwtSecret(): string {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret || secret === "your-secret-key-change-in-production" || secret === "default-secret-change-in-production") {
    console.error("CRITICAL: JWT_SECRET is not properly configured!");
    throw new Error("JWT_SECRET must be configured for production");
  }
  return secret;
}

// Base64URL encoding
function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Base64URL decoding
function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export interface JWTPayload {
  [key: string]: unknown;
  exp?: number;
  iat?: number;
  jti?: string;
}

/**
 * Sign a JWT using HMAC-SHA256
 * Uses Web Crypto API for secure signing
 */
export async function signJWT(
  payload: Record<string, unknown>,
  expiresInSeconds: number = 7 * 24 * 60 * 60 // 7 days default
): Promise<string> {
  const secret = getJwtSecret();
  const encoder = new TextEncoder();
  
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID(); // Add unique token ID for revocation support
  
  const jwtPayload: JWTPayload = {
    ...payload,
    exp: now + expiresInSeconds,
    iat: now,
    jti,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(jwtPayload)));

  // Import key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Create signature
  const signatureData = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, signatureData);
  const signature = base64UrlEncode(signatureBuffer);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify a JWT using HMAC-SHA256
 * Returns the payload if valid, null otherwise
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getJwtSecret();
    const encoder = new TextEncoder();
    
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.warn("JWT verification failed: Invalid token format");
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Import key for HMAC-SHA256 verification
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Verify signature
    const signatureData = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const signatureBytes = base64UrlDecode(signature);
    
    // Create a new ArrayBuffer copy to avoid SharedArrayBuffer issues
    const signatureArrayBuffer = new ArrayBuffer(signatureBytes.length);
    const signatureView = new Uint8Array(signatureArrayBuffer);
    signatureView.set(signatureBytes);
    
    const isValid = await crypto.subtle.verify("HMAC", key, signatureArrayBuffer, signatureData);
    
    if (!isValid) {
      console.warn("JWT verification failed: Invalid signature");
      return null;
    }

    // Decode payload
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.warn("JWT verification failed: Token expired");
      return null;
    }

    return payload as JWTPayload;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

/**
 * Decode JWT without verification (for inspection only)
 * WARNING: Do not use this for authentication - use verifyJWT instead
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Get token expiration date
 */
export function getTokenExpiration(token: string): Date | null {
  const payload = decodeJWT(token);
  if (!payload?.exp) return null;
  return new Date((payload.exp as number) * 1000);
}

/**
 * Check if token needs refresh (e.g., expires within 1 hour)
 */
export function tokenNeedsRefresh(token: string, thresholdSeconds: number = 3600): boolean {
  const payload = decodeJWT(token);
  if (!payload?.exp) return true;
  
  const now = Math.floor(Date.now() / 1000);
  return (payload.exp as number) - now < thresholdSeconds;
}
