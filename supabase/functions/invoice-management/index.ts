/**
 * Invoice Management Edge Function
 * Handles CRUD operations for invoices with proper authentication
 * Phase 5: Advanced Invoice Management
 * Updated: 2025-11-17 - Added retry logic for invoice number generation
 * Updated: 2025-12-06 - Added credit gating for free tier users
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateInvoiceManagement, type InvoiceManagementInput } from './validation.ts';
import { resolveTenantId, verifyTenantAccess } from './tenant-resolver.ts';
import { handleList } from './handlers/list.ts';
import { handleCreate } from './handlers/create.ts';
import { handleSend } from './handlers/send.ts';
import { handleUpdate } from './handlers/update.ts';
import { handleGet } from './handlers/get.ts';
import { handleDelete } from './handlers/delete.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Create client with user token for auth validation
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    let requestBody: InvoiceManagementInput;
    try {
      const rawBody = await req.json();
      requestBody = validateInvoiceManagement(rawBody);
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, invoice_id, invoice_data } = requestBody;

    // Resolve and verify tenant access
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { tenantId, error: tenantError } = await resolveTenantId(
      serviceClient, user.id, user.email, requestBody.tenant_id
    );
    if (tenantError) return tenantError;

    const accessError = await verifyTenantAccess(serviceClient, tenantId!, user.id, user.email);
    if (accessError) return accessError;

    // Route to appropriate handler
    switch (action || 'list') {
      case 'list':
        return await handleList(supabase, serviceClient, tenantId!);
      case 'create':
        return await handleCreate(serviceClient, tenantId!, invoice_data as Record<string, unknown> | undefined);
      case 'send':
        return await handleSend(serviceClient, tenantId!, invoice_id);
      case 'update':
        return await handleUpdate(serviceClient, tenantId!, invoice_id, invoice_data as Record<string, unknown> | undefined);
      case 'get':
        return await handleGet(serviceClient, tenantId!, invoice_id);
      case 'delete':
        return await handleDelete(serviceClient, tenantId!, invoice_id);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
