/**
 * Invoice Management Edge Function
 * Handles CRUD operations for invoices with proper authentication
 * Phase 5: Advanced Invoice Management
 * Updated: 2025-11-17 - Added retry logic for invoice number generation
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { validateInvoiceManagement, type InvoiceManagementInput } from './validation.ts';

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

    const { action, tenant_id, invoice_id, invoice_data } = requestBody;

    // Get tenant_id from user context if not provided
    let tenantId = tenant_id;
    
    if (!tenantId) {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: tenantUser } = await serviceClient
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tenantUser) {
        tenantId = tenantUser.tenant_id;
      } else {
        const { data: tenant } = await serviceClient
          .from('tenants')
          .select('id')
          .eq('owner_email', user.email)
          .maybeSingle();

        if (tenant) {
          tenantId = tenant.id;
        }
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found or user not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this tenant
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id, owner_email')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isOwner = tenant.owner_email?.toLowerCase() === user.email?.toLowerCase();
    const { data: tenantUser } = await serviceClient
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!isOwner && !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - no access to this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    if (action === 'list' || !action) {
      // Call RPC function to get invoices
      const { data: invoices, error: rpcError } = await serviceClient
        .rpc('get_tenant_invoices', { tenant_id: tenantId });

      if (rpcError) {
        // Fallback to direct query
        const { data: invoiceData, error: queryError } = await serviceClient
          .from('invoices')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('issue_date', { ascending: false })
          .limit(100);

        if (queryError) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch invoices', details: queryError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ invoices: invoiceData || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ invoices: invoices || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create') {
      if (!invoice_data) {
        return new Response(
          JSON.stringify({ error: 'Invoice data is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate invoice number via robust DB generator (fallback to timestamp if RPC fails)
      let invoiceNumber: string | undefined = invoice_data.invoice_number;
      const fallbackInvoiceNumber = () => `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      if (!invoiceNumber) {
        try {
          const { data: gen, error: genErr } = await serviceClient.rpc('generate_invoice_number', { tenant_id: tenantId });
          if (!genErr && typeof gen === 'string' && gen.trim()) {
            invoiceNumber = gen.trim();
          } else {
            invoiceNumber = fallbackInvoiceNumber();
          }
        } catch (_e) {
          invoiceNumber = fallbackInvoiceNumber();
        }
      }

      // Calculate amounts if not provided
      const subtotal = invoice_data.subtotal || 0;
      const tax = invoice_data.tax || 0;
      const total = invoice_data.total || (subtotal + tax);
      const amountDue = total - (invoice_data.amount_paid || 0);

      let createdInvoice: any = null;
      let lastError: any = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        const newInvoice = {
          tenant_id: tenantId,
          invoice_number: invoiceNumber,
          subtotal,
          tax,
          total,
          amount_paid: invoice_data.amount_paid || 0,
          amount_due: amountDue,
          line_items: invoice_data.line_items || [],
          billing_period_start: invoice_data.billing_period_start || null,
          billing_period_end: invoice_data.billing_period_end || null,
          issue_date: invoice_data.issue_date || new Date().toISOString().split('T')[0],
          due_date: invoice_data.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: invoice_data.status || 'draft',
          stripe_invoice_id: invoice_data.stripe_invoice_id || null,
          stripe_payment_intent_id: invoice_data.stripe_payment_intent_id || null,
        };

        const { data, error } = await serviceClient
          .from('invoices')
          .insert(newInvoice)
          .select()
          .single();

        if (!error) {
          createdInvoice = data;
          lastError = null;
          break;
        }

        lastError = error;
        const code = (error as any)?.code || '';
        const msg = (error as any)?.message || '';
        const isUnique = code === '23505' || /duplicate key value|unique constraint/i.test(msg);

        if (attempt === 0 && isUnique) {
          // Retry once with a freshly generated number
          try {
            const { data: gen2, error: genErr2 } = await serviceClient.rpc('generate_invoice_number', { tenant_id: tenantId });
            if (!genErr2 && typeof gen2 === 'string' && gen2.trim()) {
              invoiceNumber = gen2.trim();
            } else {
              invoiceNumber = fallbackInvoiceNumber();
            }
          } catch (_e) {
            invoiceNumber = fallbackInvoiceNumber();
          }
          continue;
        } else {
          break;
        }
      }

      if (lastError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create invoice', details: lastError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, invoice: createdInvoice }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update') {
      if (!invoice_id || !invoice_data) {
        return new Response(
          JSON.stringify({ error: 'Invoice ID and data are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Recalculate amounts if relevant fields are updated
      const updateData: any = { ...invoice_data };
      if (updateData.subtotal !== undefined || updateData.tax !== undefined) {
        const subtotal = updateData.subtotal || 0;
        const tax = updateData.tax || 0;
        updateData.total = subtotal + tax;
        updateData.amount_due = updateData.total - (updateData.amount_paid || 0);
      }

      const { data: updatedInvoice, error: updateError } = await serviceClient
        .from('invoices')
        .update(updateData)
        .eq('id', invoice_id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update invoice', details: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, invoice: updatedInvoice }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get') {
      if (!invoice_id) {
        return new Response(
          JSON.stringify({ error: 'Invoice ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Call RPC function to get single invoice
      const { data: invoice, error: rpcError } = await serviceClient
        .rpc('get_invoice', { invoice_id: invoice_id });

      if (rpcError) {
        // Fallback to direct query
        const { data: invoiceData, error: queryError } = await serviceClient
          .from('invoices')
          .select('*')
          .eq('id', invoice_id)
          .eq('tenant_id', tenantId)
          .single();

        if (queryError) {
          return new Response(
            JSON.stringify({ error: 'Invoice not found', details: queryError.message }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ invoice: invoiceData }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ invoice }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (!invoice_id) {
        return new Response(
          JSON.stringify({ error: 'Invoice ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Only allow deletion of draft invoices
      const { data: invoice } = await serviceClient
        .from('invoices')
        .select('status')
        .eq('id', invoice_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!invoice) {
        return new Response(
          JSON.stringify({ error: 'Invoice not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (invoice.status !== 'draft') {
        return new Response(
          JSON.stringify({ error: 'Only draft invoices can be deleted' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await serviceClient
        .from('invoices')
        .delete()
        .eq('id', invoice_id)
        .eq('tenant_id', tenantId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to delete invoice', details: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

