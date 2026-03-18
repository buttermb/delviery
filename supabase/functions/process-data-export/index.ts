import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { validateProcessDataExport, ALLOWED_DATA_TYPES, ALLOWED_FORMATS } from './validation.ts';

const BATCH_SIZE = 1000;
const MAX_PAGES = 100; // 100k row safety limit
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

serve(
  withZenProtection(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Parse body once — capture exportId early for error handling
    let exportId: string | null = null;

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

      if (!supabaseUrl || !serviceRoleKey || !anonKey) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate auth
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Missing authorization' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify user identity via JWT
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate request body with Zod
      const body = await req.json();
      const { exportId: validatedExportId } = validateProcessDataExport(body);
      exportId = validatedExportId;

      // Service role client for data operations
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // 1. Fetch export job and verify ownership
      const { data: job, error: jobError } = await supabaseAdmin
        .from('data_exports')
        .select('*')
        .eq('id', exportId)
        .maybeSingle();

      if (jobError || !job) {
        return new Response(
          JSON.stringify({ error: 'Export job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the requesting user belongs to the same tenant
      const { data: membership } = await supabaseAdmin
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('tenant_id', job.tenant_id)
        .maybeSingle();

      if (!membership) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate data_type is allowed
      if (!ALLOWED_DATA_TYPES.includes(job.data_type)) {
        await markJobFailed(supabaseAdmin, exportId, `Unsupported data type: ${job.data_type}`);
        return new Response(
          JSON.stringify({ error: 'Unsupported data type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate format
      if (!ALLOWED_FORMATS.includes(job.format)) {
        await markJobFailed(supabaseAdmin, exportId, `Unsupported format: ${job.format}`);
        return new Response(
          JSON.stringify({ error: 'Unsupported format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Update status to processing
      await supabaseAdmin
        .from('data_exports')
        .update({ status: 'processing' })
        .eq('id', exportId);

      // 3. Fetch data in batches
      const allRows: Record<string, unknown>[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: fetchError } = await supabaseAdmin
          .from(job.data_type)
          .select('*')
          .eq('tenant_id', job.tenant_id)
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

        if (fetchError) throw fetchError;

        if (!batch || batch.length < BATCH_SIZE) {
          hasMore = false;
        }
        if (batch) {
          allRows.push(...batch);
        }
        page++;

        if (page >= MAX_PAGES) break;
      }

      // 4. Generate file content
      const { fileBody, contentType, extension } = generateFileContent(allRows, job.format);

      // 5. Upload to storage
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${job.tenant_id}/${job.data_type}-${timestamp}-${exportId}.${extension}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('exports')
        .upload(filename, fileBody, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      // 6. Generate signed URL (7-day expiry)
      const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from('exports')
        .createSignedUrl(filename, SIGNED_URL_EXPIRY_SECONDS);

      if (urlError) throw urlError;

      // 7. Update job as completed
      await supabaseAdmin
        .from('data_exports')
        .update({
          status: 'completed',
          download_url: urlData.signedUrl,
          row_count: allRows.length,
        })
        .eq('id', exportId);

      return new Response(
        JSON.stringify({ success: true, message: 'Export completed', row_count: allRows.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: unknown) {
      console.error('process-data-export error:', error);

      // Attempt to mark job as failed
      if (exportId) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          if (supabaseUrl && serviceRoleKey) {
            const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
            await markJobFailed(supabaseAdmin, exportId, error instanceof Error ? error.message : 'Unknown error');
          }
        } catch (_e) {
          // Ignore secondary errors during cleanup
        }
      }

      const message = error instanceof Error ? error.message : 'Export processing failed';
      return new Response(
        JSON.stringify({ error: message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  })
);

/** Mark an export job as failed */
async function markJobFailed(
  supabase: ReturnType<typeof createClient>,
  exportId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from('data_exports')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', exportId);
}

/** Escape a value for CSV output */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/** Generate CSV content from rows */
function generateCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map(escapeCsvValue).join(',');
  const dataRows = rows.map((row) =>
    headers.map((field) => escapeCsvValue(row[field])).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

/** Generate file content based on format */
function generateFileContent(
  rows: Record<string, unknown>[],
  format: string,
): { fileBody: string; contentType: string; extension: string } {
  switch (format) {
    case 'csv':
      return {
        fileBody: generateCsv(rows),
        contentType: 'text/csv',
        extension: 'csv',
      };
    case 'json':
      return {
        fileBody: JSON.stringify(rows, null, 2),
        contentType: 'application/json',
        extension: 'json',
      };
    case 'excel': {
      // Generate a TSV file (tab-separated) as a lightweight Excel-compatible format
      // Real .xlsx generation would require a library not available in Deno edge runtime
      const tsvContent = generateTsv(rows);
      return {
        fileBody: tsvContent,
        contentType: 'text/tab-separated-values',
        extension: 'tsv',
      };
    }
    default:
      return {
        fileBody: generateCsv(rows),
        contentType: 'text/csv',
        extension: 'csv',
      };
  }
}

/** Generate TSV content (Excel-compatible) */
function generateTsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerRow = headers.join('\t');
  const dataRows = rows.map((row) =>
    headers
      .map((field) => {
        const val = row[field] === null || row[field] === undefined ? '' : String(row[field]);
        // Escape tabs and newlines within cell values
        return val.replace(/[\t\n\r]/g, ' ');
      })
      .join('\t')
  );
  return [headerRow, ...dataRows].join('\n');
}
