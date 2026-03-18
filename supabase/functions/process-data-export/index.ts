import { serve, createClient, corsHeaders, z } from "../_shared/deps.ts";
import { withZenProtection } from "../_shared/zen-firewall.ts";

const RequestSchema = z.object({
  exportId: z.string().uuid(),
});

serve(withZenProtection(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Parse and validate request body early so we can reference exportId in error handler
  let exportId: string | null = null;

  try {
    const body = RequestSchema.parse(await req.json());
    exportId = body.exportId;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for processing (bypasses RLS for background job)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch export job
    const { data: job, error: jobError } = await supabaseAdmin
      .from("data_exports")
      .select("*")
      .eq("id", exportId)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Export job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to the tenant that owns this export
    const { data: membership } = await supabaseAdmin
      .from("tenant_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Mark as processing
    await supabaseAdmin
      .from("data_exports")
      .update({ status: "processing" })
      .eq("id", exportId);

    // 3. Fetch data in batches
    const batchSize = 1000;
    const maxPages = 100; // 100k row safety limit
    let page = 0;
    let hasMore = true;
    const allRows: Record<string, unknown>[] = [];

    while (hasMore && page < maxPages) {
      const from = page * batchSize;
      const to = from + batchSize - 1;

      const { data: batch, error: fetchError } = await supabaseAdmin
        .from(job.data_type)
        .select("*")
        .eq("tenant_id", job.tenant_id)
        .range(from, to);

      if (fetchError) throw fetchError;
      if (!batch || batch.length === 0) break;

      allRows.push(...batch);
      hasMore = batch.length === batchSize;
      page++;
    }

    // 4. Generate file content
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${job.tenant_id}/${job.data_type}-${timestamp}-${exportId}.${job.format}`;
    let fileBody: string;
    let contentType: string;

    if (job.format === "csv") {
      contentType = "text/csv";
      if (allRows.length > 0) {
        const headers = Object.keys(allRows[0]);
        const headerRow = headers.join(",");
        const rows = allRows.map((row) =>
          headers
            .map((field) => {
              const val = row[field] === null || row[field] === undefined ? "" : String(row[field]);
              return `"${val.replace(/"/g, '""')}"`;
            })
            .join(",")
        );
        fileBody = [headerRow, ...rows].join("\n");
      } else {
        fileBody = "";
      }
    } else {
      contentType = "application/json";
      fileBody = JSON.stringify(allRows, null, 2);
    }

    // 5. Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("exports")
      .upload(filename, fileBody, { contentType, upsert: true });

    if (uploadError) throw uploadError;

    // 6. Generate signed URL (7 days)
    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from("exports")
      .createSignedUrl(filename, 60 * 60 * 24 * 7);

    if (urlError) throw urlError;

    // 7. Update job as completed
    await supabaseAdmin
      .from("data_exports")
      .update({
        status: "completed",
        download_url: urlData.signedUrl,
        row_count: allRows.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", exportId);

    return new Response(
      JSON.stringify({ success: true, message: "Export completed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("process-data-export error:", error);

    // Mark job as failed if we have an exportId
    if (exportId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabaseAdmin
          .from("data_exports")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", exportId);
      } catch (_markError) {
        console.error("Failed to mark export as failed:", _markError);
      }
    }

    // Zod validation errors return 400
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
