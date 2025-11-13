import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { dataType, tenantId } = await req.json();

    console.log(`Starting encryption for ${dataType} in tenant ${tenantId}`);

    const results = {
      medical: { success: 0, failed: 0, errors: [] as string[] },
      pii: { success: 0, failed: 0, errors: [] as string[] },
      financial: { success: 0, failed: 0, errors: [] as string[] }
    };

    // Encrypt Medical Data
    if (!dataType || dataType === 'medical') {
      // Encrypt medical_patient_info
      const { data: medicalPatients } = await supabaseClient
        .from('medical_patient_info')
        .select('id, account_id')
        .eq('is_encrypted', false);

      if (medicalPatients) {
        for (const patient of medicalPatients) {
          const { error } = await supabaseClient.rpc('encrypt_medical_patient_data', {
            patient_id: patient.id
          });

          if (error) {
            results.medical.failed++;
            results.medical.errors.push(`Patient ${patient.id}: ${error.message}`);
          } else {
            results.medical.success++;
            
            // Log to audit table
            await supabaseClient.from('medical_data_access_audit').insert({
              tenant_id: tenantId,
              patient_id: patient.id,
              accessed_by: null,
              access_type: 'modify',
              access_reason: 'Batch encryption',
              compliance_flag: 'HIPAA'
            });
          }
        }
      }

      // Encrypt customer medical data
      const { data: customers } = await supabaseClient
        .from('customers')
        .select('id, account_id')
        .eq('medical_data_encrypted', false)
        .eq('is_medical_patient', true);

      if (customers) {
        for (const customer of customers) {
          const { error } = await supabaseClient.rpc('encrypt_customer_medical_data', {
            customer_id: customer.id
          });

          if (error) {
            results.medical.failed++;
            results.medical.errors.push(`Customer ${customer.id}: ${error.message}`);
          } else {
            results.medical.success++;
          }
        }
      }
    }

    // Encrypt PII Data
    if (!dataType || dataType === 'pii') {
      // Encrypt customer PII
      const { data: customers } = await supabaseClient
        .from('customers')
        .select('id, account_id')
        .eq('pii_encrypted', false);

      if (customers) {
        for (const customer of customers) {
          const { error } = await supabaseClient.rpc('encrypt_customer_pii', {
            customer_id: customer.id
          });

          if (error) {
            results.pii.failed++;
            results.pii.errors.push(`Customer ${customer.id}: ${error.message}`);
          } else {
            results.pii.success++;
            
            // Log to audit table
            await supabaseClient.from('pii_access_audit').insert({
              tenant_id: tenantId,
              entity_type: 'customer',
              entity_id: customer.id,
              accessed_by: null,
              access_type: 'modify',
              access_reason: 'Batch encryption',
              compliance_flag: 'GDPR'
            });
          }
        }
      }

      // Encrypt customer_users PII
      const { data: customerUsers } = await supabaseClient
        .from('customer_users')
        .select('id, account_id')
        .eq('pii_encrypted', false);

      if (customerUsers) {
        for (const user of customerUsers) {
          const { error } = await supabaseClient.rpc('encrypt_customer_user_pii', {
            user_id: user.id
          });

          if (error) {
            results.pii.failed++;
            results.pii.errors.push(`Customer user ${user.id}: ${error.message}`);
          } else {
            results.pii.success++;
          }
        }
      }

      // Encrypt wholesale_clients PII
      const { data: wholesaleClients } = await supabaseClient
        .from('wholesale_clients')
        .select('id, tenant_id')
        .eq('pii_encrypted', false);

      if (wholesaleClients) {
        for (const client of wholesaleClients) {
          const { error } = await supabaseClient.rpc('encrypt_wholesale_client_pii', {
            client_id: client.id
          });

          if (error) {
            results.pii.failed++;
            results.pii.errors.push(`Wholesale client ${client.id}: ${error.message}`);
          } else {
            results.pii.success++;
          }
        }
      }
    }

    // Encrypt Financial Data
    if (!dataType || dataType === 'financial') {
      // Encrypt wholesale client financial data
      const { data: wholesaleClients } = await supabaseClient
        .from('wholesale_clients')
        .select('id, tenant_id')
        .eq('financial_data_encrypted', false);

      if (wholesaleClients) {
        for (const client of wholesaleClients) {
          const { error } = await supabaseClient.rpc('encrypt_wholesale_client_financial', {
            client_id: client.id
          });

          if (error) {
            results.financial.failed++;
            results.financial.errors.push(`Wholesale client ${client.id}: ${error.message}`);
          } else {
            results.financial.success++;
            
            // Log to audit table
            await supabaseClient.from('financial_data_access_audit').insert({
              tenant_id: client.tenant_id,
              entity_type: 'wholesale_client',
              entity_id: client.id,
              accessed_by: null,
              access_type: 'modify',
              access_reason: 'Batch encryption'
            });
          }
        }
      }

      // Encrypt customer payments
      const { data: payments } = await supabaseClient
        .from('customer_payments')
        .select('id')
        .eq('payment_data_encrypted', false);

      if (payments) {
        for (const payment of payments) {
          const { error } = await supabaseClient.rpc('encrypt_customer_payment', {
            payment_id: payment.id
          });

          if (error) {
            results.financial.failed++;
            results.financial.errors.push(`Payment ${payment.id}: ${error.message}`);
          } else {
            results.financial.success++;
          }
        }
      }
    }

    console.log('Encryption completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Encryption completed: Medical (${results.medical.success} success, ${results.medical.failed} failed), PII (${results.pii.success} success, ${results.pii.failed} failed), Financial (${results.financial.success} success, ${results.financial.failed} failed)`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error encrypting data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});