import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      full_name,
      email,
      phone,
      license_number,
      vehicle_type,
      vehicle_make,
      vehicle_model,
      vehicle_plate,
      age_verified = true // Default to true for admin-added couriers
    } = body;

    // Validate required fields
    if (!full_name || !email || !phone || !license_number || !vehicle_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if courier email already exists
    const { data: existingCourier } = await supabase
      .from('couriers')
      .select('id')
      .eq('email', email)
      .single();

    if (existingCourier) {
      return new Response(
        JSON.stringify({ error: 'Courier with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a temporary user for the courier (they can set password later)
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name,
        phone
      }
    });

    if (createUserError) {
      console.error('Failed to create auth user:', createUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to create courier account' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert courier record
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .insert({
        user_id: authData.user.id,
        full_name,
        email,
        phone,
        license_number,
        vehicle_type,
        vehicle_make,
        vehicle_model,
        vehicle_plate,
        age_verified,
        is_active: true,
        is_online: false
      })
      .select()
      .single();

    if (courierError) {
      console.error('Failed to create courier:', courierError);
      // Cleanup: delete auth user if courier creation failed
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to create courier record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign courier role
    await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'courier'
      });

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        entity_type: 'courier',
        entity_id: courier.id,
        action: 'CREATE',
        user_id: user.id,
        details: {
          courier_name: full_name,
          email,
          vehicle_type
        }
      });

    console.log('Courier created successfully:', courier.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        courier,
        message: 'Courier added successfully. They will receive an email to set their password.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in add-courier function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});