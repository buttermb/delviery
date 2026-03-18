/**
 * Clerk Webhook Handler
 * Syncs Clerk users to Supabase for hybrid auth
 * 
 * Events handled:
 * - user.created: Create tenant_users record
 * - user.updated: Sync profile changes
 * - user.deleted: Deactivate user
 * - session.created: Log sign-ins
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

interface ClerkUser {
  id: string;
  email_addresses: { email_address: string; id: string; verification: { status: string } }[];
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUser | { user_id?: string; [key: string]: unknown };
  object: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify webhook signature
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    const webhookSecret = Deno.env.get('CLERK_WEBHOOK_SECRET');
    
    let event: ClerkWebhookEvent;
    
    // Get body as text for signature verification
    const bodyText = await req.text();
    
    // Verify signature if secret and headers are present
    if (webhookSecret && svixId && svixTimestamp && svixSignature) {
      try {
        const signedContent = `${svixId}.${svixTimestamp}.${bodyText}`;
        const encoder = new TextEncoder();
        
        // Decode the base64 secret (remove 'whsec_' prefix)
        const secretBytes = Uint8Array.from(atob(webhookSecret.replace('whsec_', '')), c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedContent));
        const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
        
        // Check if any of the provided signatures match
        const providedSignatures = svixSignature.split(' ').map(s => s.split(',')[1]);
        const isValid = providedSignatures.some(sig => sig === computedSignature);
        
        if (!isValid) {
          console.error('[CLERK-WEBHOOK] Invalid signature');
          return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        console.log('[CLERK-WEBHOOK] Signature verified successfully');
      } catch (verifyError) {
        console.warn('[CLERK-WEBHOOK] Signature verification failed:', verifyError);
      }
    } else {
      console.warn('[CLERK-WEBHOOK] Skipping signature verification (missing secret or headers)');
    }
    
    // Parse the body
    event = JSON.parse(bodyText);
    console.log('[CLERK-WEBHOOK] Processing event:', event.type);

    switch (event.type) {
      case 'user.created': {
        const user = event.data as ClerkUser;
        const email = user.email_addresses[0]?.email_address?.toLowerCase();
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || email?.split('@')[0] || 'User';
        const tenantId = user.public_metadata?.tenant_id as string | undefined;
        const role = (user.public_metadata?.role as string) || 'member';

        console.log('[CLERK-WEBHOOK] Creating user:', { clerkId: user.id, email, tenantId, role });

        if (tenantId) {
          // Check if user already exists
          const { data: existingUser } = await supabase
            .from('tenant_users')
            .select('id')
            .eq('email', email)
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (!existingUser) {
            const { error } = await supabase
              .from('tenant_users')
              .insert({
                tenant_id: tenantId,
                user_id: user.id,
                clerk_user_id: user.id,
                email,
                name,
                role,
                status: 'active',
                avatar_url: user.image_url,
                email_verified: user.email_addresses[0]?.verification?.status === 'verified',
                invited_at: new Date(user.created_at).toISOString(),
                accepted_at: new Date().toISOString(),
              });

            if (error) {
              console.error('[CLERK-WEBHOOK] Failed to create tenant_user:', error);
            } else {
              console.log('[CLERK-WEBHOOK] Created tenant_user for:', email);
            }
          } else {
            // Update existing user with Clerk ID
            await supabase
              .from('tenant_users')
              .update({
                clerk_user_id: user.id,
                avatar_url: user.image_url,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingUser.id);

            console.log('[CLERK-WEBHOOK] Updated existing tenant_user:', email);
          }
        } else {
          // No tenant - might be super admin or pending signup
          console.log('[CLERK-WEBHOOK] User has no tenant_id, checking for super admin');
          
          const { data: superAdmin } = await supabase
            .from('super_admin_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (superAdmin) {
            await supabase
              .from('super_admin_users')
              .update({
                clerk_user_id: user.id,
                avatar_url: user.image_url,
                updated_at: new Date().toISOString(),
              })
              .eq('id', superAdmin.id);

            console.log('[CLERK-WEBHOOK] Updated super_admin_user:', email);
          }
        }
        break;
      }

      case 'user.updated': {
        const user = event.data as ClerkUser;
        const email = user.email_addresses[0]?.email_address?.toLowerCase();
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ');

        console.log('[CLERK-WEBHOOK] Updating user:', { clerkId: user.id, email });

        // Update tenant_users
        const { error: tenantUserError } = await supabase
          .from('tenant_users')
          .update({
            name: name || undefined,
            avatar_url: user.image_url,
            email_verified: user.email_addresses[0]?.verification?.status === 'verified',
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', user.id);

        if (tenantUserError && tenantUserError.code !== 'PGRST116') {
          console.error('[CLERK-WEBHOOK] Failed to update tenant_user:', tenantUserError);
        }

        // Also try super_admin_users
        await supabase
          .from('super_admin_users')
          .update({
            avatar_url: user.image_url,
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', user.id);

        console.log('[CLERK-WEBHOOK] User updated:', email);
        break;
      }

      case 'user.deleted': {
        const userId = (event.data as { user_id?: string }).user_id || (event.data as { id?: string }).id;
        console.log('[CLERK-WEBHOOK] Deleting user:', userId);

        // Soft delete by setting status to inactive
        await supabase
          .from('tenant_users')
          .update({
            status: 'inactive',
            updated_at: new Date().toISOString(),
          })
          .eq('clerk_user_id', userId);

        console.log('[CLERK-WEBHOOK] User deactivated:', userId);
        break;
      }

      case 'session.created': {
        const sessionData = event.data as { user_id?: string };
        const userId = sessionData.user_id;
        
        if (userId) {
          console.log('[CLERK-WEBHOOK] Session created for user:', userId);

          // Update last login timestamp
          await supabase
            .from('tenant_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('clerk_user_id', userId);
        }
        break;
      }

      default:
        console.log('[CLERK-WEBHOOK] Unhandled event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[CLERK-WEBHOOK] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

