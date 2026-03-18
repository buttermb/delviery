/**
 * Send Invitation Email
 * Sends team member invitation email with invitation link
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const invitationEmailSchema = z.object({
  to: z.string().email(),
  tenant_name: z.string(),
  tenant_slug: z.string().optional(),
  role: z.string(),
  invite_link: z.string().url(),
  expires_at: z.string().optional(),
  invited_by: z.string().optional(),
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
    const { to, tenant_name, tenant_slug, role, invite_link, expires_at, invited_by } = invitationEmailSchema.parse(body);

    // Get tenant info for email branding
    let businessName = tenant_name;
    if (tenant_slug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('business_name, white_label')
        .eq('slug', tenant_slug)
        .maybeSingle();
      
      if (tenant) {
        businessName = tenant.business_name;
      }
    }

    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || 'https://app.example.com';
    const roleDisplayName = role === 'owner' ? 'Owner' : role === 'admin' ? 'Administrator' : role === 'member' ? 'Team Member' : role === 'viewer' ? 'Viewer' : role;

    // Format expiration date
    let expirationText = '';
    if (expires_at) {
      const expiresDate = new Date(expires_at);
      expirationText = `This invitation expires on ${expiresDate.toLocaleDateString()} at ${expiresDate.toLocaleTimeString()}.`;
    } else {
      expirationText = 'This invitation expires in 7 days.';
    }

    // Email content
    const subject = `You've been invited to join ${businessName}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Team Invitation</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi there,</p>
            <p>You've been invited to join <strong>${businessName}</strong> as a <strong>${roleDisplayName}</strong>.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px dashed #667eea;">
              <p style="margin: 0; font-size: 14px; color: #666;">Click the button below to accept your invitation:</p>
              <p style="margin: 20px 0;">
                <a href="${invite_link}" 
                   style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Accept Invitation
                </a>
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">${expirationText}</p>
            </div>

            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${invite_link}" style="color: #667eea; word-break: break-all;">${invite_link}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Team Invitation

Hi there,

You've been invited to join ${businessName} as a ${roleDisplayName}.

Accept your invitation by clicking this link:
${invite_link}

${expirationText}

If you didn't expect this invitation, you can safely ignore this email.
    `.trim();

    // Send email via Klaviyo if available, otherwise log
    const klaviyoApiKey = Deno.env.get('KLAVIYO_API_KEY');
    if (klaviyoApiKey) {
      try {
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-klaviyo-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to,
            subject,
            html: htmlContent,
            text: textContent,
            fromEmail: Deno.env.get('FROM_EMAIL') || 'noreply@example.com',
            fromName: businessName,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('Failed to send invitation email via Klaviyo:', errorText);
          // Don't fail the request - email sending is best effort
        } else {
          console.log('Invitation email sent successfully to:', to);
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // Don't fail the request - email sending is best effort
      }
    } else {
      // Log email for development
      console.log('Invitation email (Klaviyo not configured):', {
        to,
        subject,
        invite_link,
        tenant_name: businessName,
        role,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email sent',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Send invitation email error:', error);
    
    // Return success even if email fails - invitation was created
    // This prevents email service issues from blocking invitations
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation created (email may not have been sent)',
        error: error instanceof Error ? error.message : 'Failed to send invitation email',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

