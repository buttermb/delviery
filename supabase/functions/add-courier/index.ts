import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('add-courier');

// Zod validation schema
const addCourierSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 characters').max(20),
  license_number: z.string().min(1, 'License number is required').max(50),
  vehicle_type: z.enum(['car', 'motorcycle', 'bicycle', 'scooter', 'walking']),
  vehicle_make: z.string().max(50).optional(),
  vehicle_model: z.string().max(50).optional(),
  vehicle_plate: z.string().max(20).optional(),
  tenant_id: z.string().uuid().optional(),
  age_verified: z.boolean().default(true),
});

serve(async (req) => {
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
      logger.warn('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Unauthorized access attempt', { error: authError?.message });
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
      .maybeSingle();

    if (!roles) {
      logger.warn('Non-admin attempted to add courier', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = addCourierSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      const zodError = validationResult as { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } };
      logger.warn('Validation failed', { errors: zodError.error.flatten() });
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: zodError.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      full_name,
      email,
      phone,
      license_number,
      vehicle_type,
      vehicle_make,
      vehicle_model,
      vehicle_plate,
      tenant_id,
      age_verified
    } = validationResult.data;

    // Get tenant_id from the admin user if not provided
    let courierTenantId = tenant_id;
    if (!courierTenantId) {
      const { data: tenantUser } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (tenantUser?.tenant_id) {
        courierTenantId = tenantUser.tenant_id;
      }
    }

    if (!courierTenantId) {
      logger.warn('Unable to determine tenant', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Unable to determine tenant. Please provide tenant_id.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if courier email already exists
    const { data: existingCourier } = await supabase
      .from('couriers')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingCourier) {
      logger.warn('Courier email already exists', { email });
      return new Response(
        JSON.stringify({ error: 'Courier with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a temporary user for the courier
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name, phone }
    });

    if (createUserError) {
      logger.error('Failed to create auth user', { error: createUserError.message });
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
        tenant_id: courierTenantId,
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
      .maybeSingle();

    if (courierError) {
      logger.error('Failed to create courier record', { error: courierError.message });
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ error: 'Failed to create courier record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign courier role
    await supabase
      .from('user_roles')
      .insert({ user_id: authData.user.id, role: 'courier' });

    // Log the action
    await supabase
      .from('audit_logs')
      .insert({
        entity_type: 'courier',
        entity_id: courier.id,
        action: 'CREATE',
        user_id: user.id,
        details: { courier_name: full_name, email, vehicle_type }
      });

    logger.info('Courier created successfully', { courierId: courier.id, tenantId: courierTenantId });

    return new Response(
      JSON.stringify({
        success: true,
        courier,
        message: 'Courier added successfully. They will receive an email to set their password.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Unexpected error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
