/**
 * Optional customer account creation at checkout.
 *
 * Creates a customer_users record, issues a JWT for auto-login,
 * and fires a verification email. Failures are non-fatal.
 */

import type { SupabaseClient } from "../../_shared/deps.ts";
import type { CheckoutRequest } from "../schemas.ts";
import type { StoreRecord } from "../types.ts";

/** Create a registered customer account if requested. Failures are non-fatal. */
export async function createCustomerAccount(
  supabase: SupabaseClient,
  req: Request,
  body: CheckoutRequest,
  store: StoreRecord,
  upsertedCustomerId: string | null,
): Promise<{
  accountToken: string | null;
  accountCustomer: Record<string, unknown> | null;
  accountTenant: Record<string, unknown> | null;
}> {
  const noAccount = { accountToken: null, accountCustomer: null, accountTenant: null };

  if (!body.createAccount || !body.password || !body.customerInfo.email) {
    return noAccount;
  }

  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, business_name, slug")
      .eq("id", store.tenant_id)
      .eq("status", "active")
      .maybeSingle();

    if (!tenant) return noAccount;

    const { data: existingUser } = await supabase
      .from("customer_users")
      .select("id")
      .eq("email", body.customerInfo.email.toLowerCase())
      .eq("tenant_id", tenant.id)
      .maybeSingle();

    if (existingUser) return noAccount;

    const passwordHash = await hashPassword(body.password);

    const { data: newUser, error: createErr } = await supabase
      .from("customer_users")
      .insert({
        email: body.customerInfo.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: body.customerInfo.firstName || null,
        last_name: body.customerInfo.lastName || null,
        phone: body.customerInfo.phone ?? null,
        tenant_id: tenant.id,
        customer_id: upsertedCustomerId,
        email_verified: false,
      })
      .select("id, email, first_name, last_name, customer_id, tenant_id")
      .single();

    if (createErr || !newUser) return noAccount;

    // Issue JWT for auto-login (30-day expiry)
    const accountToken = await signJWT(
      {
        customer_user_id: newUser.id,
        customer_id: upsertedCustomerId || newUser.id,
        tenant_id: tenant.id,
        type: "customer",
      },
      30 * 24 * 60 * 60,
    );

    // Create session record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabase.from("customer_sessions").insert({
      customer_user_id: newUser.id,
      tenant_id: tenant.id,
      token: accountToken,
      ip_address: clientIp,
      user_agent: userAgent,
      expires_at: expiresAt.toISOString(),
    });

    const accountCustomer = {
      id: newUser.id,
      email: newUser.email,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
      customer_id: newUser.customer_id,
      tenant_id: tenant.id,
    };
    const accountTenant = {
      id: tenant.id,
      business_name: tenant.business_name,
      slug: tenant.slug,
    };

    // Fire-and-forget verification email
    const supabaseUrlForEmail = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKeyForEmail = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    fetch(`${supabaseUrlForEmail}/functions/v1/send-verification-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKeyForEmail}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_user_id: newUser.id,
        tenant_id: tenant.id,
        email: body.customerInfo.email.toLowerCase(),
        tenant_name: tenant.business_name,
      }),
    }).catch(() => {
      // Verification email failure is non-fatal
    });

    return { accountToken, accountCustomer, accountTenant };
  } catch {
    // Account creation failure is non-fatal — order already succeeded
    return noAccount;
  }
}
