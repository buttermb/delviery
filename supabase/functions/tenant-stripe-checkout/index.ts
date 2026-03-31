import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { Stripe, STRIPE_API_VERSION } from '../_shared/stripe.ts';
import { getOrCreateStripeCustomer } from '../_shared/stripe-customer.ts';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { line_items, success_url, cancel_url } = await req.json();

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid line_items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate line_items structure and cap quantity
    const MAX_LINE_ITEMS = 20;
    const MAX_QUANTITY = 100;
    if (line_items.length > MAX_LINE_ITEMS) {
      return new Response(
        JSON.stringify({ error: `Too many line items (max ${MAX_LINE_ITEMS})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    for (const item of line_items) {
      if (!item.price || typeof item.price !== 'string') {
        return new Response(
          JSON.stringify({ error: "Each line_item must have a valid 'price' string" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (item.quantity != null && (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > MAX_QUANTITY)) {
        return new Response(
          JSON.stringify({ error: `Quantity must be between 1 and ${MAX_QUANTITY}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get tenant_id from tenant_users
    const { data: tenantUser } = await supabaseClient
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tenantUser) {
      throw new Error("Tenant not found for user");
    }

    // Get account_id from accounts
    const { data: account } = await supabaseClient
      .from("accounts")
      .select("id")
      .eq("tenant_id", tenantUser.tenant_id)
      .maybeSingle();

    if (!account) {
      throw new Error("Account not found");
    }

    // Get tenant Stripe credentials from account_settings
    const { data: settings } = await supabaseClient
      .from("account_settings")
      .select("integration_settings")
      .eq("account_id", account.id)
      .maybeSingle();

    const integrationSettings = settings?.integration_settings as Record<string, unknown> | null;
    const tenantStripeSecretKey = integrationSettings?.stripe_secret_key;

    if (!tenantStripeSecretKey) {
      return new Response(
        JSON.stringify({ 
          error: "Stripe not configured",
          message: "Please configure your Stripe credentials in Settings → Integrations"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe with TENANT's credentials
    const stripe = new Stripe(tenantStripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    // Get tenant record for shared customer creation
    const { data: tenant } = await supabaseClient
      .from("tenants")
      .select("id, slug, stripe_customer_id, owner_email, business_name")
      .eq("id", tenantUser.tenant_id)
      .maybeSingle();

    // Get or create customer (idempotent)
    const customerId = await getOrCreateStripeCustomer({
      stripe,
      supabase: supabaseClient,
      tenant: tenant || { id: tenantUser.tenant_id, slug: null, stripe_customer_id: null, owner_email: user.email ?? null, business_name: null },
      email: user.email,
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items,
      mode: "payment",
      success_url: success_url || `${req.headers.get("origin")}/payment-success`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/payment-canceled`,
      metadata: {
        tenant_id: tenantUser.tenant_id,
      },
    });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        session_id: session.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});