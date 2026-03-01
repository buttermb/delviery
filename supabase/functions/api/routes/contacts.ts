/**
 * Contacts Route Handlers
 * 
 * Unified handlers for all contact types:
 * - Retail customers
 * - Wholesale clients
 * - CRM leads
 */

import { createClient, corsHeaders, z } from '../../_shared/deps.ts';
import { sanitizeSearchInput } from '../../_shared/searchSanitize.ts';

type RequestHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

// Validation schemas
const CreateContactSchema = z.object({
  contact_type: z.array(z.enum(['retail', 'wholesale', 'crm'])).default(['retail']),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  // Wholesale fields
  business_name: z.string().optional(),
  credit_limit: z.number().nonnegative().optional(),
  payment_terms: z.string().optional(),
  client_type: z.enum(['sub_dealer', 'small_shop', 'network', 'supplier', 'distributor', 'dispensary']).optional(),
  // CRM fields
  lead_status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  lead_source: z.string().optional(),
  company_name: z.string().optional(),
  job_title: z.string().optional(),
  // Common
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateContactSchema = CreateContactSchema.partial();

// Helper to get authenticated user and tenant
async function getAuthContext(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization');
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    throw new Error('Invalid token');
  }

  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('tenant_id')
    .eq('user_id', user.id)
    .single();

  if (!tenantUser?.tenant_id) {
    throw new Error('No tenant access');
  }

  return { supabase, userId: user.id, tenantId: tenantUser.tenant_id };
}

// Helper for error responses
function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper for success responses
function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// HANDLERS
// ============================================================================

// List contacts with filtering
async function listContacts(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const url = new URL(req.url);
    
    // Parse query params
    const contactType = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (contactType) {
      query = query.contains('contact_type', [contactType]);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      const escaped = sanitizeSearchInput(search);
      query = query.or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%,business_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(error.message);
    }

    return jsonResponse({ 
      data, 
      pagination: { 
        total: count, 
        limit, 
        offset,
        hasMore: (offset + limit) < (count || 0)
      } 
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Get single contact
async function getContact(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId } = await getAuthContext(req);
    const contactId = params.id;

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return errorResponse(error.message, error.code === 'PGRST116' ? 404 : 400);
    }

    return jsonResponse({ data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Create contact
async function createContact(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const body = await req.json();

    // Validate input
    const validation = CreateContactSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${validation.error.message}`);
    }

    const input = validation.data;

    // Check for duplicate email
    if (input.email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', input.email)
        .single();

      if (existing) {
        return errorResponse('A contact with this email already exists');
      }
    }

    // Create contact
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        ...input,
      })
      .select()
      .single();

    if (error) {
      return errorResponse(error.message);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'data_access',
      p_event_type: 'contact_created',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'contact',
      p_target_id: data.id,
      p_details: { contact_type: input.contact_type },
    });

    return jsonResponse({ data }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Update contact
async function updateContact(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const contactId = params.id;
    const body = await req.json();

    // Validate input
    const validation = UpdateContactSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(`Validation error: ${validation.error.message}`);
    }

    const input = validation.data;

    // Check email uniqueness if changing email
    if (input.email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', input.email)
        .neq('id', contactId)
        .single();

      if (existing) {
        return errorResponse('A contact with this email already exists');
      }
    }

    // Update contact
    const { data, error } = await supabase
      .from('contacts')
      .update(input)
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, error.code === 'PGRST116' ? 404 : 400);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'data_access',
      p_event_type: 'contact_updated',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'contact',
      p_target_id: contactId,
      p_details: { updated_fields: Object.keys(input) },
    });

    return jsonResponse({ data });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Delete contact
async function deleteContact(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const contactId = params.id;

    // Soft delete - just mark as inactive
    const { data, error } = await supabase
      .from('contacts')
      .update({ status: 'inactive' })
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, error.code === 'PGRST116' ? 404 : 400);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'data_access',
      p_event_type: 'contact_deleted',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'contact',
      p_target_id: contactId,
    });

    return jsonResponse({ message: 'Contact deleted successfully' });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Update credit balance
async function updateBalance(req: Request, params: Record<string, string>): Promise<Response> {
  try {
    const { supabase, tenantId, userId } = await getAuthContext(req);
    const contactId = params.id;
    const body = await req.json();

    const { amount, operation } = body;
    if (typeof amount !== 'number' || !['add', 'subtract'].includes(operation)) {
      return errorResponse('Invalid amount or operation');
    }

    const { data: newBalance, error } = await supabase.rpc('update_contact_balance', {
      p_contact_id: contactId,
      p_amount: amount,
      p_operation: operation,
    });

    if (error) {
      return errorResponse(error.message);
    }

    // Log audit event
    await supabase.rpc('log_audit_event', {
      p_tenant_id: tenantId,
      p_category: 'billing',
      p_event_type: 'balance_updated',
      p_actor_type: 'tenant_user',
      p_actor_id: userId,
      p_target_type: 'contact',
      p_target_id: contactId,
      p_details: { amount, operation, new_balance: newBalance },
    });

    return jsonResponse({ 
      message: 'Balance updated successfully',
      new_balance: newBalance 
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 401);
  }
}

// Export route handlers
export const contactsRouter: Record<string, RequestHandler> = {
  'GET /contacts': listContacts,
  'GET /contacts/:id': getContact,
  'POST /contacts': createContact,
  'PUT /contacts/:id': updateContact,
  'DELETE /contacts/:id': deleteContact,
  'POST /contacts/:id/balance': updateBalance,
};

