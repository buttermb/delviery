/**
 * Send Email Verification Code
 * Sends verification email to customer after signup
 */

import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';

const verificationEmailSchema = z.object({
  customer_user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  tenant_name: z.string().optional(),
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
    const { customer_user_id, tenant_id, email, tenant_name } = verificationEmailSchema.parse(body);

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiration (15 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Store verification code
    const { error: insertError } = await supabase
      .from('email_verification_codes')
      .insert({
        customer_user_id,
        tenant_id,
        code,
        email: email.toLowerCase(),
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to store verification code:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant info for email branding
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, slug')
      .eq('id', tenant_id)
      .single();

    const businessName = tenant_name || tenant?.business_name || 'Our Store';
    const siteUrl = Deno.env.get('SITE_URL') || 'https://app.example.com';
    const verificationUrl = `${siteUrl}/${tenant?.slug || 'shop'}/verify-email?code=${code}&email=${encodeURIComponent(email)}`;

    // Email content
    const subject = `Verify your email address - ${businessName}`;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Verify Your Email</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi there,</p>
            <p>Thank you for signing up with <strong>${businessName}</strong>! Please verify your email address to complete your registration.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px dashed #667eea;">
              <p style="margin: 0; font-size: 14px; color: #666;">Your verification code is:</p>
              <h2 style="margin: 10px 0; font-size: 32px; letter-spacing: 5px; color: #667eea;">${code}</h2>
              <p style="margin: 0; font-size: 12px; color: #999;">This code expires in 15 minutes</p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Verify Email Address
              </a>
            </p>

            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
            </p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999;">
              If you didn't create an account with ${businessName}, please ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Verify Your Email Address

Hi there,

Thank you for signing up with ${businessName}! Please verify your email address to complete your registration.

Your verification code is: ${code}
This code expires in 15 minutes.

Verify your email by clicking this link:
${verificationUrl}

If you didn't create an account with ${businessName}, please ignore this email.
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
            to: email,
            subject,
            html: htmlContent,
            text: textContent,
            fromEmail: Deno.env.get('FROM_EMAIL') || 'noreply@example.com',
            fromName: businessName,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Failed to send email via Klaviyo:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    } else {
      // Log email for development
      console.log('Verification email (Klaviyo not configured):', {
        to: email,
        subject,
        code,
        verificationUrl,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification email sent',
        code: Deno.env.get('ENV') === 'development' ? code : undefined, // Only return code in dev
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Send verification email error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send verification email',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

