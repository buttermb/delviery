import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

/**
 * SECURITY FIX: This function now derives the Stripe customer ID from the
 * authenticated user's tenant, NOT from client input. This prevents
 * cross-tenant payment operations.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========================
    // SECURITY: Extract and validate JWT
    // ========================
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const jwt = authHeader.replace("Bearer ", "");

    // Create authenticated Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // ========================
    // SECURITY: Look up user's tenant and get stripe_customer_id from DB
    // ========================
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the user's tenant membership
    const { data: tenantUser, error: tenantUserError } = await serviceClient
      .from("tenant_users")
      .select("tenant_id, role, tenants!inner(id, stripe_customer_id, name)")
      .eq("user_id", user.id)
      .single();

    if (tenantUserError || !tenantUser) {
      console.error("Tenant lookup failed:", tenantUserError);
      return new Response(
        JSON.stringify({ success: false, error: "User not associated with a tenant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // SECURITY: Only admins/owners can retry payments
    if (!["admin", "owner"].includes(tenantUser.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Insufficient permissions - admin or owner required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const tenant = tenantUser.tenants as unknown as { id: string; stripe_customer_id: string | null; name: string };

    if (!tenant.stripe_customer_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No Stripe customer linked to this tenant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const customerId = tenant.stripe_customer_id;

    // ========================
    // Process Stripe payment retry
    // ========================
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey || !stripeKey.startsWith("sk_")) {
      throw new Error("STRIPE_SECRET_KEY is not properly configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find open or past_due invoices for this customer
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: "open",
      limit: 5,
    });

    const pastDueInvoices = await stripe.invoices.list({
      customer: customerId,
      limit: 5,
    });

    const unpaidInvoice = invoices.data[0] ||
      pastDueInvoices.data.find((inv: Stripe.Invoice) => inv.status === "open" || inv.status === "past_due");

    if (!unpaidInvoice) {
      return new Response(
        JSON.stringify({ success: false, error: "No unpaid invoice found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Retry the payment
    const paidInvoice = await stripe.invoices.pay(unpaidInvoice.id);

    // Audit log
    await serviceClient.from("audit_logs").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      action: "payment_retry",
      resource_type: "invoice",
      resource_id: paidInvoice.id,
      details: {
        stripe_customer_id: customerId,
        invoice_status: paidInvoice.status,
        amount_paid: paidInvoice.amount_paid,
      },
    });

    console.log(`Payment retried: ${paidInvoice.id} for tenant ${tenant.name} by user ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        invoice: {
          id: paidInvoice.id,
          status: paidInvoice.status,
          amount_paid: paidInvoice.amount_paid,
          currency: paidInvoice.currency,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: unknown) {
    console.error("Retry payment error:", error);

    let errorMessage = "Failed to retry payment";

    if (error instanceof Stripe.errors.StripeCardError) {
      errorMessage = (error as Stripe.errors.StripeCardError).message || "Card was declined";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
