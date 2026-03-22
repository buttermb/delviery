import { serve, createClient, z, corsHeaders } from "../_shared/deps.ts";
import { errorResponse } from "../_shared/error-response.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";

const RefundSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  amount: z.number().positive("Amount must be positive").optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth check ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(401, "Unauthorized");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(401, "Invalid token");
    }

    // Resolve tenant from authenticated user
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tenantUser?.tenant_id) {
      return errorResponse(403, "Forbidden: no tenant membership");
    }

    const tenantId = tenantUser.tenant_id;
    // --- End auth check ---

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    if (!stripeKey.startsWith("sk_")) {
      throw new Error("Invalid STRIPE_SECRET_KEY format - must start with 'sk_'");
    }

    // Validate request body
    const body = await req.json();
    const validationResult = RefundSchema.safeParse(body);
    
    if (!validationResult.success) {
      return errorResponse(
        400,
        (validationResult as { success: false; error: { errors: { message: string }[] } }).error.errors[0].message,
        'VALIDATION_ERROR',
      );
    }

    const { customerId, amount, reason } = validationResult.data;

    // Verify the Stripe customer belongs to the caller's tenant
    const { data: tenant } = await supabase
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant?.stripe_customer_id || tenant.stripe_customer_id !== customerId) {
      return errorResponse(403, "Forbidden: customer does not belong to your tenant");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find the most recent successful payment intent for this customer
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 10,
    });

    const successfulPayment = paymentIntents.data.find(
      (pi: Stripe.PaymentIntent) => pi.status === "succeeded" && pi.latest_charge
    );

    if (!successfulPayment) {
      return errorResponse(404, "No successful payment found for this customer");
    }

    // Create the refund
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: successfulPayment.id,
    };

    if (amount) {
      refundParams.amount = amount;
    }

    if (reason) {
      refundParams.reason = reason;
    }

    const refund = await stripe.refunds.create(refundParams);

    console.error(`Refund created successfully: ${refund.id} for customer ${customerId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          currency: refund.currency,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Refund error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to process refund";
    
    return errorResponse(500, errorMessage);
  }
});
