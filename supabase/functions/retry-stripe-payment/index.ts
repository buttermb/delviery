import { serve, createClient, z, corsHeaders } from "../_shared/deps.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const RetryPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
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
    const validationResult = RetryPaymentSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: validationResult.error.errors[0].message 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { customerId } = validationResult.data;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find open or past_due invoices for this customer
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: "open",
      limit: 5,
    });

    // Also check for past_due invoices
    const pastDueInvoices = await stripe.invoices.list({
      customer: customerId,
      limit: 5,
    });

    const unpaidInvoice = invoices.data[0] || 
      pastDueInvoices.data.find((inv: Stripe.Invoice) => inv.status === "open" || inv.status === "past_due");

    if (!unpaidInvoice) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No unpaid invoice found for this customer" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Retry the payment
    const paidInvoice = await stripe.invoices.pay(unpaidInvoice.id);

    console.log(`Payment retried successfully: ${paidInvoice.id} for customer ${customerId}`);

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
