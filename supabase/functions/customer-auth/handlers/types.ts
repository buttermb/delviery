import { createClient } from '../../_shared/deps.ts';
import { signJWT, verifyJWT as verifyJWTSecure } from '../../_shared/jwt.ts';

import type { SupabaseClient } from '../../_shared/deps.ts';

export interface CustomerJWTPayload {
  customer_user_id: string;
  customer_id: string;
  tenant_id: string;
  type: "customer";
}

export type SupabaseInstance = SupabaseClient;

export interface HandlerContext {
  req: Request;
  supabase: SupabaseInstance;
  supabaseUrl: string;
  supabaseKey: string;
  requestBody: Record<string, unknown>;
  corsHeaders: Record<string, string>;
}

// Wrapper for signing customer tokens
export async function createCustomerToken(payload: { customer_user_id: string; customer_id: string; tenant_id: string; type: "customer" }): Promise<string> {
  return await signJWT({ ...payload }, 7 * 24 * 60 * 60); // 7 days
}

// Wrapper for verifying customer tokens
export async function verifyCustomerToken(token: string): Promise<CustomerJWTPayload | null> {
  const payload = await verifyJWTSecure(token);
  if (!payload) return null;
  if (payload.type !== "customer") return null;
  return payload as unknown as CustomerJWTPayload;
}

// Helper to create a service client (used by signup for cross-table checks)
export function createServiceClient(): SupabaseInstance {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}
