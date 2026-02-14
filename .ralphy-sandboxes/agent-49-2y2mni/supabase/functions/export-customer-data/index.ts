/**
 * Export Customer Data (GDPR Compliance)
 * Generates a JSON export of all customer data with PHI decryption
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { decryptCustomerFields, logPHIAccess } from '../_shared/encryption.ts';

const exportDataSchema = z.object({
  customer_user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  format: z.enum(['json', 'csv']).default('json'),
  encryption_password: z.string().optional(),
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
    const { customer_user_id, tenant_id, format, encryption_password } = exportDataSchema.parse(body);

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

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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

    if (customerUser.customer_id) {
      const { data: customerRecord } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerUser.customer_id)
        .maybeSingle();

      if (customerRecord) {
        if (customerRecord.is_encrypted && encryption_password) {
          try {
            const decrypted = await decryptCustomerFields(customerRecord, encryption_password);
            exportData.customer_record = decrypted;
            
            await logPHIAccess(
              supabase,
              customerRecord.id,
              'export',
              Object.keys(decrypted).filter(k => !k.includes('_encrypted')),
              customer_user_id,
              'GDPR data export request'
            );
          } catch (error) {
            console.error('Failed to decrypt customer data:', error);
            exportData.customer_record = { error: 'Failed to decrypt PHI' };
          }
        } else if (customerRecord.is_encrypted) {
          exportData.customer_record = {
            note: 'Customer PHI is encrypted. Provide encryption_password to decrypt.',
            encrypted: true,
          };
        } else {
          exportData.customer_record = customerRecord;
        }
      }
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerUser.customer_id || customer_user_id)
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (orders) {
      exportData.orders = orders;
      
      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        if (orderItems) exportData.order_items = orderItems;
      }
    }

    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', customerUser.customer_id || customer_user_id);
    if (addresses) exportData.addresses = addresses;

    const { data: loyaltyPoints } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('customer_id', customerUser.customer_id || customer_user_id)
      .eq('tenant_id', tenant_id);
    if (loyaltyPoints) exportData.loyalty_points = loyaltyPoints;

    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', customerUser.customer_id || customer_user_id);
    if (reviews) exportData.reviews = reviews;

    await supabase
      .from('data_export_requests')
      .update({
        status: 'completed',
        export_data: exportData,
        completed_at: new Date().toISOString(),
      })
      .eq('id', exportRequest.id);

    if (format === 'csv') {
      let csv = 'Section,Field,Value\n';
      const flattenObject = (obj: any, prefix = '') => {
        for (const key in obj) {
          const value = obj[key];
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            flattenObject(value, prefix ? `${prefix}.${key}` : key);
          } else {
            csv += `${prefix},${key},"${String(value).replace(/"/g, '""')}"\n`;
          }
        }
      };
      flattenObject(exportData);
      
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="customer-data-${customer_user_id}.csv"`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        export_request_id: exportRequest.id,
        data: exportData,
        expires_at: expiresAt.toISOString(),
        note: exportData.customer_record?.encrypted 
          ? 'PHI data is encrypted. Provide encryption_password to decrypt.'
          : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
