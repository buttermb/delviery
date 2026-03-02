import { serve, createClient, z, corsHeaders } from "../_shared/deps.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

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
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: (validationResult as { success: false; error: { errors: { message: string }[] } }).error.errors[0].message 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { customerId, amount, reason } = validationResult.data;

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
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No successful payment found for this customer" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
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

    console.log(`Refund created successfully: ${refund.id} for customer ${customerId}`);

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
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
