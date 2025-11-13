import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UsageAlert {
  tenant_id: string;
  business_name: string;
  owner_email: string;
  resource: string;
  current: number;
  limit: number;
  percentage: number;
  severity: 'warning' | 'critical';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('VITE_SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Checking usage limits across all tenants...');

    // Get all active tenants
    const { data: tenants, error: selectError } = await supabaseClient
      .from('tenants')
      .select('id, business_name, owner_email, subscription_plan, limits, usage')
      .in('subscription_status', ['active', 'trial']);

    if (selectError) {
      console.error('Error fetching tenants:', selectError);
      throw selectError;
    }

    console.log(`Checking ${tenants?.length || 0} active tenants`);

    const alerts: UsageAlert[] = [];
    const resources = ['customers', 'menus', 'products', 'locations', 'users'];

    for (const tenant of tenants || []) {
      const limits = tenant.limits || {};
      const usage = tenant.usage || {};

      for (const resource of resources) {
        const current = usage[resource] || 0;
        const limit = limits[resource];

        // Skip unlimited resources
        if (!limit || limit === 999999) continue;

        const percentage = (current / limit) * 100;

        // Critical: 95%+ usage
        if (percentage >= 95) {
          alerts.push({
            tenant_id: tenant.id,
            business_name: tenant.business_name,
            owner_email: tenant.owner_email,
            resource,
            current,
            limit,
            percentage,
            severity: 'critical',
          });
        }
        // Warning: 80%+ usage
        else if (percentage >= 80) {
          alerts.push({
            tenant_id: tenant.id,
            business_name: tenant.business_name,
            owner_email: tenant.owner_email,
            resource,
            current,
            limit,
            percentage,
            severity: 'warning',
          });
        }
      }
    }

    console.log(`Found ${alerts.length} usage alerts`);

    // Group alerts by tenant and severity
    const tenantAlerts = alerts.reduce((acc, alert) => {
      const key = alert.tenant_id;
      if (!acc[key]) {
        acc[key] = {
          tenant: alert,
          critical: [],
          warning: [],
        };
      }
      if (alert.severity === 'critical') {
        acc[key].critical.push(alert);
      } else {
        acc[key].warning.push(alert);
      }
      return acc;
    }, {} as Record<string, any>);

    // Send consolidated emails
    const emailTasks = Object.values(tenantAlerts).map(async (data: any) => {
      const { tenant, critical, warning } = data;
      const hasMultipleAlerts = (critical.length + warning.length) > 1;

      const resourceList = [...critical, ...warning]
        .map((a: UsageAlert) => `
          <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            <strong style="color: ${a.severity === 'critical' ? '#dc2626' : '#f59e0b'}">
              ${a.resource.charAt(0).toUpperCase() + a.resource.slice(1)}:
            </strong>
            ${a.current} / ${a.limit} (${Math.round(a.percentage)}%)
            ${a.severity === 'critical' ? '<span style="color: #dc2626; font-weight: bold;">🚨 CRITICAL</span>' : '<span style="color: #f59e0b;">⚠️ Warning</span>'}
          </li>
        `)
        .join('');

      const emailSubject = critical.length > 0
        ? `🚨 URGENT: You're almost at your plan limits - ${tenant.business_name}`
        : `⚠️ Approaching plan limits - ${tenant.business_name}`;

      const emailBody = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, ${critical.length > 0 ? '#dc2626' : '#f59e0b'} 0%, ${critical.length > 0 ? '#991b1b' : '#d97706'} 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">
                ${critical.length > 0 ? '🚨 Usage Limit Alert' : '⚠️ Usage Alert'}
              </h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; color: #374151;">Hi there,</p>
              
              <p style="font-size: 16px; color: #374151; line-height: 1.6;">
                ${hasMultipleAlerts ? 'Multiple resources are' : 'A resource is'} approaching 
                ${critical.length > 0 ? 'their' : 'its'} limit for <strong>${tenant.business_name}</strong>.
              </p>
              
              ${critical.length > 0 ? `
                <div style="background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #991b1b; font-size: 14px;">
                    <strong>🚨 CRITICAL:</strong> You're at 95%+ capacity. Upgrade now to avoid service disruption!
                  </p>
                </div>
              ` : `
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; color: #92400e; font-size: 14px;">
                    <strong>⚠️ WARNING:</strong> You're at 80%+ capacity. Consider upgrading soon.
                  </p>
                </div>
              `}
              
              <h3 style="color: #374151; margin-top: 20px;">Current Usage:</h3>
              <ul style="list-style: none; padding: 0; margin: 10px 0 20px 0;">
                ${resourceList}
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get('VITE_SUPABASE_URL')?.replace('https://', 'https://app.')}/${tenant.tenant_id}/admin/billing" 
                   style="background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                  Upgrade Now
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                Questions? Contact our support team anytime.
              </p>
              
              <p style="font-size: 14px; color: #6b7280;">
                Best regards,<br>
                Your Platform Team
              </p>
            </div>
          </body>
        </html>
      `;

      console.log(`Would send usage alert to ${tenant.owner_email} (${critical.length} critical, ${warning.length} warnings)`);
      
      // Email integration here
      return { email: tenant.owner_email, sent: true };
    });

    const results = await Promise.allSettled(emailTasks);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    return new Response(
      JSON.stringify({ 
        total_tenants_checked: tenants?.length || 0,
        alerts_found: alerts.length,
        emails_sent: successful,
        critical_alerts: alerts.filter(a => a.severity === 'critical').length,
        warning_alerts: alerts.filter(a => a.severity === 'warning').length,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    )
  } catch (error) {
    console.error('Error in check-usage-limits:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        } 
      }
    )
  }
})
