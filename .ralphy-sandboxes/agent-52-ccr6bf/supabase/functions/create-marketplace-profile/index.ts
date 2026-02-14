// @ts-nocheck
import { serve, createClient, corsHeaders } from "../_shared/deps.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CreateProfileSchema = z.object({
  tenant_id: z.string().uuid(),
  business_name: z.string().min(1),
  business_description: z.string().optional(),
  license_number: z.string().min(1),
  license_type: z.string().min(1),
  license_state: z.string().min(1),
  license_expiry_date: z.string().optional(),
  license_document_url: z.string().url(),
  shipping_states: z.array(z.string()).min(1),
  logo_url: z.string().url().optional(),
  cover_image_url: z.string().url().optional(),
  shipping_policy: z.string().optional(),
  return_policy: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse and validate request body
    const rawBody = await req.json();
    const body = CreateProfileSchema.parse(rawBody);

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('marketplace_profiles')
      .select('id')
      .eq('tenant_id', body.tenant_id)
      .maybeSingle();

    const profileData = {
      tenant_id: body.tenant_id,
      business_name: body.business_name,
      business_description: body.business_description || null,
      license_number: body.license_number,
      license_type: body.license_type,
      license_state: body.license_state,
      license_expiry_date: body.license_expiry_date ? new Date(body.license_expiry_date).toISOString() : null,
      license_document_url: body.license_document_url,
      shipping_states: body.shipping_states,
      logo_url: body.logo_url || null,
      cover_image_url: body.cover_image_url || null,
      shipping_policy: body.shipping_policy || null,
      return_policy: body.return_policy || null,
      marketplace_status: 'pending',
      can_sell: false,
      license_verified: false,
    };

    let profile;
    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('marketplace_profiles')
        .update(profileData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      profile = data;
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('marketplace_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) throw error;
      profile = data;
    }

    // Log platform transaction (profile creation event)
    await supabase
      .from('platform_transactions')
      .insert({
        tenant_id: body.tenant_id,
        transaction_type: 'subscription_fee', // Or create a new type 'profile_creation'
        amount: 0,
        status: 'collected',
        description: 'Marketplace profile created',
        metadata: {
          profile_id: profile.id,
          action: existing ? 'updated' : 'created',
        },
      })
      .catch((err) => {
        console.warn('Failed to log platform transaction (non-blocking)', err);
      });

    return new Response(
      JSON.stringify({
        success: true,
        profile,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('Error in create-marketplace-profile:', error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: error.errors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

