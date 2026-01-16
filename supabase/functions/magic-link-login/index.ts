// Edge Function: magic-link-login
import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const sendMagicLinkSchema = z.object({
    email: z.string().email(),
    redirectTo: z.string().url().optional()
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
        const validation = sendMagicLinkSchema.safeParse(body);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: 'Invalid email address' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { email, redirectTo } = validation.data;
        const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

        // Rate limit check
        const { data: rateCheck } = await supabase.rpc('check_auth_rate_limit', {
            p_identifier: email,
            p_identifier_type: 'email',
            p_max_attempts: 3, // More restrictive for magic links (email spam prevention)
            p_window_minutes: 15
        });

        if (rateCheck && !rateCheck.allowed) {
            return new Response(
                JSON.stringify({ error: 'Too many requests. Please try again later.' }),
                { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Send magic link via Supabase Auth (built-in)
        const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: redirectTo || `${supabaseUrl.replace('.supabase.co', '')}/dashboard`,
                shouldCreateUser: false // Only allow existing users
            }
        });

        if (otpError) {
            // Don't expose if user exists or not (security)
            return new Response(
                JSON.stringify({ success: true, message: 'If this email exists, a login link was sent.' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Log compliance event
        await supabase.rpc('log_compliance_event', {
            p_tenant_id: null,
            p_user_id: null,
            p_action: 'magic_link_sent',
            p_details: { email: email.substring(0, 3) + '***' }, // Partial email for privacy
            p_ip_address: clientIp
        });

        return new Response(
            JSON.stringify({ success: true, message: 'Check your email for a login link!' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Failed to send magic link' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
