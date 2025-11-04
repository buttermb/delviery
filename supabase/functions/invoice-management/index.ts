/**
 * Invoice Management Edge Function
 * Handles CRUD operations for invoices with proper authentication
 * Phase 5: Advanced Invoice Management
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Parse request body
    let requestBody: any = {};
    try {
      requestBody = await req.json();
    } catch {
      requestBody = {};
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

      // Generate invoice number if not provided
      const invoiceNumber = invoice_data.invoice_number || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Calculate amounts if not provided
      const subtotal = invoice_data.subtotal || 0;
      const tax = invoice_data.tax || 0;
      const total = invoice_data.total || (subtotal + tax);
      const amountDue = total - (invoice_data.amount_paid || 0);

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

      const { data: createdInvoice, error: createError } = await serviceClient
        .from('invoices')
        .insert(newInvoice)
        .select()
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create invoice', details: createError.message }),
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

