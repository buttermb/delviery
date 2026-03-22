import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { checkCreditsAvailable } from "../_shared/creditGate.ts";

const INVOICE_CREATE_ACTION_KEY = "invoice_create";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    console.error(`[generate-recurring-invoices] Running for date: ${today}`);

    // Fetch all active schedules due today or earlier
    const { data: schedules, error: schedulesError } = await supabase
      .from("recurring_invoice_schedules")
      .select(`
        *,
        client:crm_clients(id, name, email, account_id),
        template:invoice_templates(template_data)
      `)
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (schedulesError) {
      console.error("[generate-recurring-invoices] Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.error(`[generate-recurring-invoices] Found ${schedules?.length || 0} schedules to process`);

    const results = {
      processed: 0,
      created: 0,
      skipped_insufficient_credits: 0,
      errors: [] as string[],
    };

    for (const schedule of schedules || []) {
      try {
        const tenantId = schedule.tenant_id;

        // Check and consume credits for the tenant before creating the invoice
        const creditCheck = await checkCreditsAvailable(
          supabase,
          tenantId,
          INVOICE_CREATE_ACTION_KEY,
        );

        if (creditCheck.isFreeTier && !creditCheck.hasCredits) {
          console.error(
            `[generate-recurring-invoices] Skipping schedule ${schedule.id}: tenant ${tenantId} has insufficient credits (balance: ${creditCheck.balance}, cost: ${creditCheck.cost})`,
          );
          results.skipped_insufficient_credits++;
          results.errors.push(
            `Schedule ${schedule.id}: Insufficient credits (balance: ${creditCheck.balance}, required: ${creditCheck.cost})`,
          );
          continue;
        }

        // Consume credits for free tier tenants before creating the invoice
        if (creditCheck.isFreeTier) {
          const { error: creditError } = await supabase.rpc("consume_credits", {
            p_tenant_id: tenantId,
            p_action_key: INVOICE_CREATE_ACTION_KEY,
            p_reference_type: "recurring_invoice",
            p_description: `Recurring invoice for schedule: ${schedule.name || schedule.id}`,
          });

          if (creditError) {
            console.error(
              `[generate-recurring-invoices] Credit deduction failed for schedule ${schedule.id}:`,
              creditError,
            );
            results.skipped_insufficient_credits++;
            results.errors.push(
              `Schedule ${schedule.id}: Credit deduction failed: ${creditError.message}`,
            );
            continue;
          }
        }

        // Generate invoice number
        const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

        // Calculate totals from line items
        const lineItems = schedule.line_items || [];
        const subtotal = lineItems.reduce(
          (sum: number, item: Record<string, unknown>) =>
            sum + (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
          0,
        );
        const taxRate = schedule.template?.template_data?.taxRate || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // Calculate due date (30 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        // Create the invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from("crm_invoices")
          .insert({
            account_id: schedule.client?.account_id,
            client_id: schedule.client_id,
            invoice_number: invoiceNumber,
            invoice_date: today,
            due_date: dueDate.toISOString().split("T")[0],
            line_items: lineItems,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total,
            status: "draft",
            template_id: schedule.template_id,
            recurring_schedule_id: schedule.id,
            is_recurring: true,
            public_token: crypto.randomUUID(),
          })
          .select()
          .single();

        if (invoiceError) {
          console.error(
            `[generate-recurring-invoices] Error creating invoice for schedule ${schedule.id}:`,
            invoiceError,
          );
          results.errors.push(`Schedule ${schedule.id}: ${invoiceError.message}`);
          continue;
        }

        console.error(
          `[generate-recurring-invoices] Created invoice ${invoice.id} for schedule ${schedule.id}`,
        );
        results.created++;

        // Calculate next run date based on frequency
        const nextDate = new Date(schedule.next_run_date);
        switch (schedule.frequency) {
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "biweekly":
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            if (schedule.day_of_month) {
              nextDate.setDate(schedule.day_of_month);
            }
            break;
          case "quarterly":
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case "yearly":
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        // Update the schedule with new next_run_date
        await supabase
          .from("recurring_invoice_schedules")
          .update({
            last_run_date: today,
            next_run_date: nextDate.toISOString().split("T")[0],
          })
          .eq("id", schedule.id);

        results.processed++;
      } catch (err) {
        console.error(
          `[generate-recurring-invoices] Error processing schedule ${schedule.id}:`,
          err,
        );
        results.errors.push(
          `Schedule ${schedule.id}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    console.error(`[generate-recurring-invoices] Completed:`, results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-recurring-invoices] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
