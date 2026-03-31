import { corsHeaders } from '../_shared/deps.ts';
import type { SupabaseClient } from '../_shared/deps.ts';

/** Courier record returned from the couriers table */
export interface CourierRecord {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  commission_rate: number;
  tenant_id: string | null;
  user_id: string;
  [key: string]: unknown;
}

/** Standard JSON response headers */
export const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

/** Build a JSON Response with consistent headers */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

/**
 * Enrich an order with customer name/phone from profiles table
 * when the order itself is missing that info.
 */
export async function enrichOrderWithCustomerInfo(
  supabase: SupabaseClient,
  order: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let customerName = order.customer_name as string | null;
  let customerPhone = order.customer_phone as string | null;

  if (!customerName || !customerPhone) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", order.user_id)
      .maybeSingle();

    if (profile) {
      customerName = (profile.full_name as string) || customerName;
      customerPhone = (profile.phone as string) || customerPhone;
    }
  }

  return {
    ...order,
    customer_name: customerName,
    customer_phone: customerPhone,
  };
}
