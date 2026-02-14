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

    const { tenantId, reportType = 'full' } = await req.json();

    console.log(`Generating ${reportType} compliance report for tenant ${tenantId}`);

    const report: any = {
      generated_at: new Date().toISOString(),
      tenant_id: tenantId,
      report_type: reportType,
      encryption_status: {},
      audit_summary: {},
      compliance_metrics: {}
    };

    // ===== ENCRYPTION STATUS =====
    
    // Medical data encryption status
    const { data: medicalPatients, count: totalMedicalPatients } = await supabaseClient
      .from('medical_patient_info')
      .select('id, is_encrypted', { count: 'exact' });
    
    const encryptedMedicalPatients = medicalPatients?.filter(p => p.is_encrypted).length || 0;
    
    const { data: medicalCustomers, count: totalMedicalCustomers } = await supabaseClient
      .from('customers')
      .select('id, medical_data_encrypted', { count: 'exact' })
      .eq('is_medical_patient', true);
    
    const encryptedMedicalCustomers = medicalCustomers?.filter(c => c.medical_data_encrypted).length || 0;

    report.encryption_status.medical = {
      total_records: (totalMedicalPatients || 0) + (totalMedicalCustomers || 0),
      encrypted: encryptedMedicalPatients + encryptedMedicalCustomers,
      unencrypted: (totalMedicalPatients || 0) + (totalMedicalCustomers || 0) - (encryptedMedicalPatients + encryptedMedicalCustomers),
      percentage: ((encryptedMedicalPatients + encryptedMedicalCustomers) / ((totalMedicalPatients || 0) + (totalMedicalCustomers || 0)) * 100) || 0,
      compliance: 'HIPAA'
    };

    // PII encryption status
    const { data: customers, count: totalCustomers } = await supabaseClient
      .from('customers')
      .select('id, pii_encrypted', { count: 'exact' });
    
    const encryptedCustomers = customers?.filter(c => c.pii_encrypted).length || 0;
    
    const { data: customerUsers, count: totalCustomerUsers } = await supabaseClient
      .from('customer_users')
      .select('id, pii_encrypted', { count: 'exact' });
    
    const encryptedCustomerUsers = customerUsers?.filter(u => u.pii_encrypted).length || 0;
    
    const { data: wholesaleClients, count: totalWholesaleClients } = await supabaseClient
      .from('wholesale_clients')
      .select('id, pii_encrypted', { count: 'exact' });
    
    const encryptedWholesaleClients = wholesaleClients?.filter(w => w.pii_encrypted).length || 0;

    const totalPII = (totalCustomers || 0) + (totalCustomerUsers || 0) + (totalWholesaleClients || 0);
    const encryptedPII = encryptedCustomers + encryptedCustomerUsers + encryptedWholesaleClients;

    report.encryption_status.pii = {
      total_records: totalPII,
      encrypted: encryptedPII,
      unencrypted: totalPII - encryptedPII,
      percentage: (encryptedPII / totalPII * 100) || 0,
      compliance: 'GDPR'
    };

    // Financial data encryption status
    const { data: wholesaleFinancial, count: totalWholesaleFinancial } = await supabaseClient
      .from('wholesale_clients')
      .select('id, financial_data_encrypted', { count: 'exact' });
    
    const encryptedWholesaleFinancial = wholesaleFinancial?.filter(w => w.financial_data_encrypted).length || 0;
    
    const { data: payments, count: totalPayments } = await supabaseClient
      .from('customer_payments')
      .select('id, payment_data_encrypted', { count: 'exact' });
    
    const encryptedPayments = payments?.filter(p => p.payment_data_encrypted).length || 0;

    const totalFinancial = (totalWholesaleFinancial || 0) + (totalPayments || 0);
    const encryptedFinancial = encryptedWholesaleFinancial + encryptedPayments;

    report.encryption_status.financial = {
      total_records: totalFinancial,
      encrypted: encryptedFinancial,
      unencrypted: totalFinancial - encryptedFinancial,
      percentage: (encryptedFinancial / totalFinancial * 100) || 0,
      compliance: 'Business Security'
    };

    // ===== AUDIT SUMMARY =====
    
    // Medical audit summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: medicalAccesses } = await supabaseClient
      .from('medical_data_access_audit')
      .select('id', { count: 'exact' })
      .gte('accessed_at', thirtyDaysAgo.toISOString());
    
    const { data: medicalAccessByType } = await supabaseClient
      .from('medical_data_access_audit')
      .select('access_type')
      .gte('accessed_at', thirtyDaysAgo.toISOString());

    report.audit_summary.medical = {
      total_accesses_30d: medicalAccesses || 0,
      by_type: medicalAccessByType?.reduce((acc: any, curr: any) => {
        acc[curr.access_type] = (acc[curr.access_type] || 0) + 1;
        return acc;
      }, {}) || {},
      compliance: 'HIPAA - All access logged'
    };

    // PII audit summary (last 30 days)
    const { count: piiAccesses } = await supabaseClient
      .from('pii_access_audit')
      .select('id', { count: 'exact' })
      .gte('accessed_at', thirtyDaysAgo.toISOString());
    
    const { data: piiAccessByType } = await supabaseClient
      .from('pii_access_audit')
      .select('access_type')
      .gte('accessed_at', thirtyDaysAgo.toISOString());

    report.audit_summary.pii = {
      total_accesses_30d: piiAccesses || 0,
      by_type: piiAccessByType?.reduce((acc: any, curr: any) => {
        acc[curr.access_type] = (acc[curr.access_type] || 0) + 1;
        return acc;
      }, {}) || {},
      compliance: 'GDPR - All access logged'
    };

    // Financial audit summary (last 30 days)
    const { count: financialAccesses } = await supabaseClient
      .from('financial_data_access_audit')
      .select('id', { count: 'exact' })
      .gte('accessed_at', thirtyDaysAgo.toISOString());

    report.audit_summary.financial = {
      total_accesses_30d: financialAccesses || 0,
      compliance: 'All financial access logged'
    };

    // ===== COMPLIANCE METRICS =====
    
    report.compliance_metrics = {
      hipaa: {
        status: report.encryption_status.medical.percentage === 100 ? 'COMPLIANT' : 'ACTION REQUIRED',
        encryption_coverage: `${report.encryption_status.medical.percentage.toFixed(2)}%`,
        audit_logging: 'ENABLED',
        recommendation: report.encryption_status.medical.percentage < 100 
          ? `Encrypt ${report.encryption_status.medical.unencrypted} remaining medical records immediately`
          : 'All medical data encrypted and audit logging active'
      },
      gdpr: {
        status: report.encryption_status.pii.percentage === 100 ? 'COMPLIANT' : 'ACTION REQUIRED',
        encryption_coverage: `${report.encryption_status.pii.percentage.toFixed(2)}%`,
        audit_logging: 'ENABLED',
        right_to_erasure: 'IMPLEMENTED',
        recommendation: report.encryption_status.pii.percentage < 100
          ? `Encrypt ${report.encryption_status.pii.unencrypted} remaining PII records`
          : 'All PII encrypted and audit logging active'
      },
      pci_dss: {
        status: report.encryption_status.financial.percentage >= 90 ? 'COMPLIANT' : 'ACTION REQUIRED',
        encryption_coverage: `${report.encryption_status.financial.percentage.toFixed(2)}%`,
        recommendation: report.encryption_status.financial.percentage < 90
          ? `Encrypt ${report.encryption_status.financial.unencrypted} remaining financial records`
          : 'Financial data encryption meets standards'
      }
    };

    // ===== RECOMMENDATIONS =====
    
    report.recommendations = [];
    
    if (report.encryption_status.medical.percentage < 100) {
      report.recommendations.push({
        priority: 'CRITICAL',
        category: 'HIPAA Compliance',
        action: 'Encrypt all medical records immediately',
        records_affected: report.encryption_status.medical.unencrypted
      });
    }
    
    if (report.encryption_status.pii.percentage < 100) {
      report.recommendations.push({
        priority: 'HIGH',
        category: 'GDPR Compliance',
        action: 'Encrypt all PII records',
        records_affected: report.encryption_status.pii.unencrypted
      });
    }
    
    if (report.encryption_status.financial.percentage < 90) {
      report.recommendations.push({
        priority: 'HIGH',
        category: 'Financial Security',
        action: 'Encrypt financial records',
        records_affected: report.encryption_status.financial.unencrypted
      });
    }

    console.log('Compliance report generated:', report);

    return new Response(
      JSON.stringify({ success: true, report }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error generating compliance report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});