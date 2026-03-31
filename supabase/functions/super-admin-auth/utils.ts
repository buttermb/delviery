// Shared utilities for super-admin-auth handlers
import type { SupabaseClient } from '../_shared/deps.ts';
import { signJWT, verifyJWT as verifyJWTSecure } from '../_shared/jwt.ts';

// ============================================================================
// Types
// ============================================================================

export interface SuperAdminJWTPayload {
  super_admin_id: string;
  role: string;
  type: "super_admin";
}

export interface HandlerContext {
  req: Request;
  supabase: SupabaseClient;
  body: Record<string, unknown>;
  corsHeaders: Record<string, string>;
}

// ============================================================================
// Token helpers
// ============================================================================

/** Sign a super admin JWT (8-hour expiry). */
export async function createSuperAdminToken(payload: {
  super_admin_id: string;
  role: string;
  type: "super_admin";
}): Promise<string> {
  return await signJWT({ ...payload }, 8 * 60 * 60); // 8 hours
}

/** Verify a super admin JWT. Returns null on failure or non-super-admin type. */
export async function verifySuperAdminToken(
  token: string,
): Promise<SuperAdminJWTPayload | null> {
  const payload = await verifyJWTSecure(token);
  if (!payload) return null;
  if (payload.type !== "super_admin") return null;
  return payload as unknown as SuperAdminJWTPayload;
}

// ============================================================================
// Password hashing (PBKDF2 via Web Crypto API)
// ============================================================================

/** Base64 encoding helper for password hashing. */
function base64Encode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

/** Hash a password using PBKDF2-SHA256 with a random 16-byte salt. */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordData = encoder.encode(password);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordData,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );

  const hashArray = new Uint8Array(hashBuffer);
  const combined = new Uint8Array(salt.length + hashArray.length);
  combined.set(salt);
  combined.set(hashArray, salt.length);

  return base64Encode(combined.buffer);
}

/** Constant-time comparison to prevent timing attacks. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

/**
 * Compare a plaintext password against a stored hash.
 * Supports both legacy SHA-256 format and new PBKDF2 format.
 */
export async function comparePassword(
  password: string,
  hashValue: string,
): Promise<boolean> {
  try {
    // Check if it's the old SHA-256 format (hex string, 64 characters)
    if (hashValue.length === 64 && /^[a-f0-9]+$/i.test(hashValue)) {
      // Old format: SHA-256(password + secret)
      const secret = Deno.env.get("PASSWORD_SECRET");
      if (!secret) {
        console.error(
          "PASSWORD_SECRET environment variable is required for legacy password verification",
        );
        return false;
      }
      const encoder = new TextEncoder();
      const data = encoder.encode(password + secret);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const computedHashBytes = new Uint8Array(hashBuffer);
      const storedHashBytes = new Uint8Array(
        hashValue
          .toLowerCase()
          .match(/.{2}/g)!
          .map((b) => parseInt(b, 16)),
      );
      return timingSafeEqual(computedHashBytes, storedHashBytes);
    }

    // New PBKDF2 format (base64 encoded)
    const encoder = new TextEncoder();
    const combined = Uint8Array.from(atob(hashValue), (c) => c.charCodeAt(0));

    const salt = combined.slice(0, 16);
    const storedHash = combined.slice(16);

    const passwordData = encoder.encode(password);
    const key = await crypto.subtle.importKey(
      "raw",
      passwordData,
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );

    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    );

    const hashArray = new Uint8Array(hashBuffer);
    return timingSafeEqual(hashArray, storedHash);
  } catch (error) {
    // console.error OK in edge functions (server-side)
    console.error("Password comparison error:", error);
    return false;
  }
}
