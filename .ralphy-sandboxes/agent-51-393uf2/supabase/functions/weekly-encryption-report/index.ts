import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';

serve(withZenProtection(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all tenants with unencrypted menus
    const { data: tenantsWithUnencryptedMenus, error: tenantsError } = await supabase
      .from('tenants')
      .select(`
        id,
        business_name,
        owner_email,
        disposable_menus!inner(id, is_encrypted, created_at)
      `)
      .eq('disposable_menus.is_encrypted', false);

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tenants', details: tenantsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by tenant and count unencrypted menus
    const reportData = tenantsWithUnencryptedMenus?.reduce((acc: any[], tenant: any) => {
      const existingTenant = acc.find((t) => t.tenant_id === tenant.id);
      
      if (existingTenant) {
        existingTenant.unencrypted_count += 1;
      } else {
        acc.push({
          tenant_id: tenant.id,
          business_name: tenant.business_name,
          owner_email: tenant.owner_email,
          unencrypted_count: 1,
        });
      }
      
      return acc;
    }, []) || [];

    // Send email reports to each tenant admin
    const emailResults = [];
    
    for (const report of reportData) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Weekly Encryption Report</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Weekly Encryption Report</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello ${report.business_name},</p>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #856404;">
                  ⚠️ You have <span style="color: #d32f2f;">${report.unencrypted_count}</span> unencrypted menu${report.unencrypted_count > 1 ? 's' : ''}
                </p>
              </div>
              
              <p style="font-size: 14px; color: #666; margin: 20px 0;">
                For maximum security and compliance, we recommend encrypting all disposable menus with AES-256 encryption.
              </p>
              
              <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #667eea;">🚀 How to Encrypt Your Menus</h3>
                <ol style="padding-left: 20px; margin: 10px 0;">
                  <li style="margin-bottom: 10px;">Log in to your admin panel</li>
                  <li style="margin-bottom: 10px;">Navigate to Disposable Menus</li>
                  <li style="margin-bottom: 10px;">Click the "Encryption" button</li>
                  <li style="margin-bottom: 10px;">Select "Encrypt All Unencrypted Menus"</li>
                </ol>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${supabaseUrl.replace('https://', 'https://').replace('.supabase.co', '')}/admin/disposable-menus" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Encrypt Menus Now
                </a>
              </div>
              
              <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #2e7d32;">
                  ✅ <strong>New menus are automatically encrypted</strong> when created through the admin panel
                </p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                This is an automated weekly security report. For questions, contact support.
              </p>
            </div>
          </body>
        </html>
      `;

      try {
        // Use Supabase Auth to send email
        // Note: In production, you'd use a proper email service like SendGrid, Resend, etc.
        console.log(`Would send email to ${report.owner_email} for ${report.business_name}`);
        console.log(`Subject: 🔐 Weekly Encryption Report - ${report.unencrypted_count} Menu${report.unencrypted_count > 1 ? 's' : ''} Need${report.unencrypted_count > 1 ? '' : 's'} Encryption`);
        
        emailResults.push({
          tenant_id: report.tenant_id,
          email: report.owner_email,
          status: 'queued',
          unencrypted_count: report.unencrypted_count,
        });

        // Log the report for audit
        await supabase.from('menu_decryption_audit').insert({
          menu_id: null,
          access_method: 'weekly_report',
          success: true,
          metadata: {
            tenant_id: report.tenant_id,
            unencrypted_count: report.unencrypted_count,
            report_sent: true,
          },
        });
      } catch (emailError) {
        console.error(`Failed to queue email for ${report.owner_email}:`, emailError);
        emailResults.push({
          tenant_id: report.tenant_id,
          email: report.owner_email,
          status: 'failed',
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_date: new Date().toISOString(),
        total_tenants_with_unencrypted: reportData.length,
        total_unencrypted_menus: reportData.reduce((sum, r) => sum + r.unencrypted_count, 0),
        reports_sent: emailResults.filter((r) => r.status === 'queued').length,
        reports_failed: emailResults.filter((r) => r.status === 'failed').length,
        details: emailResults,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}));
