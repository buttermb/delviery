/**
 * Export Customer Data (GDPR Compliance)
 * Generates a JSON export of all customer data
 */

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const exportDataSchema = z.object({
  customer_user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  format: z.enum(['json', 'csv']).default('json'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { customer_user_id, tenant_id, format } = exportDataSchema.parse(body);

    // Verify customer exists and belongs to tenant
    const { data: customerUser, error: customerError } = await supabase
      .from('customer_users')
      .select('*')
      .eq('id', customer_user_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (customerError || !customerUser) {
      return new Response(
        JSON.stringify({ error: 'Customer account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create export request record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const { data: exportRequest, error: requestError } = await supabase
      .from('data_export_requests')
      .insert({
        customer_user_id,
        tenant_id,
        status: 'processing',
        export_format: format,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (requestError || !exportRequest) {
      console.error('Failed to create export request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Failed to create export request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Collect all customer data
    const exportData: any = {
      export_date: new Date().toISOString(),
      customer_id: customer_user_id,
      tenant_id: tenant_id,
      personal_information: {
        email: customerUser.email,
        first_name: customerUser.first_name,
        last_name: customerUser.last_name,
        phone: customerUser.phone,
        date_of_birth: customerUser.date_of_birth,
        created_at: customerUser.created_at,
        email_verified_at: customerUser.email_verified_at,
        age_verified_at: customerUser.age_verified_at,
      },
      account_settings: {
        status: customerUser.status,
        email_verified: customerUser.email_verified,
        age_verified: !!customerUser.age_verified_at,
      },
    };

    // Get linked customer record
    if (customerUser.customer_id) {
      const { data: customerRecord } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerUser.customer_id)
        .maybeSingle();

      if (customerRecord) {
        exportData.customer_record = customerRecord;
      }
    }

    // Get orders
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerUser.customer_id || customer_user_id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (orders) {
      exportData.orders = orders;
    }

    // Get order items
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);

      if (orderItems) {
        exportData.order_items = orderItems;
      }
    }

    // Get sessions (excluding tokens for security)
    const { data: sessions } = await supabase
      .from('customer_sessions')
      .select('id, ip_address, user_agent, created_at, expires_at')
      .eq('customer_user_id', customer_user_id)
      .order('created_at', { ascending: false });

    if (sessions) {
      exportData.sessions = sessions;
    }

    // Get age verification logs
    const { data: ageLogs } = await supabase
      .from('age_verification_logs')
      .select('*')
      .eq('customer_user_id', customer_user_id)
      .order('verified_at', { ascending: false });

    if (ageLogs) {
      exportData.age_verification_history = ageLogs;
    }

    // Convert to requested format
    let exportContent: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      exportContent = JSON.stringify(exportData, null, 2);
      contentType = 'application/json';
      filename = `customer-data-export-${customer_user_id}-${Date.now()}.json`;
    } else {
      // CSV format (simplified - just orders for now)
      const csvRows: string[] = [];
      csvRows.push('Export Date,Type,Data');
      csvRows.push(`${new Date().toISOString()},Personal Information,${JSON.stringify(exportData.personal_information)}`);
      
      if (exportData.orders) {
        exportData.orders.forEach((order: any) => {
          csvRows.push(`${order.created_at},Order,${JSON.stringify(order)}`);
        });
      }
      
      exportContent = csvRows.join('\n');
      contentType = 'text/csv';
      filename = `customer-data-export-${customer_user_id}-${Date.now()}.csv`;
    }

    // Store export in Supabase Storage (if bucket exists)
    let fileUrl: string | null = null;
    try {
      const filePath = `customer-exports/${customer_user_id}/${filename}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('customer-data-exports')
        .upload(filePath, exportContent, {
          contentType,
          upsert: false,
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('customer-data-exports')
          .getPublicUrl(filePath);
        
        fileUrl = urlData?.publicUrl || null;
      }
    } catch (storageError) {
      console.error('Storage upload error:', storageError);
      // Continue without storage - return data directly
    }

    // Update export request
    await supabase
      .from('data_export_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        file_url: fileUrl,
      })
      .eq('id', exportRequest.id);

    // Return export data
    if (fileUrl) {
      return new Response(
        JSON.stringify({
          success: true,
          export_id: exportRequest.id,
          download_url: fileUrl,
          expires_at: expiresAt.toISOString(),
          message: 'Your data export is ready. The download link will expire in 7 days.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Return data directly if storage failed
      return new Response(
        exportContent,
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        }
      );
    }
  } catch (error: unknown) {
    console.error('Export data error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to export data',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

