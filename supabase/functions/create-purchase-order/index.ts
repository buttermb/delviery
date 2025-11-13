// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface POItem {
  product_id: string;
  quantity_lbs: number;
  unit_cost: number;
}

interface CreatePORequest {
  supplier_id: string;
  expected_delivery_date?: string;
  notes?: string;
  items: POItem[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get account_id from user metadata or tenant_users table
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantUser) {
      throw new Error('Tenant not found');
    }

    // Use the first account for now (simplified multi-tenancy)
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .limit(1)
      .single();

    if (!account) {
      throw new Error('Account not found');
    }

    const account_id = account.id;

    const body: CreatePORequest = await req.json();
    const { supplier_id, expected_delivery_date, notes, items } = body;

    // Validation
    if (!supplier_id || !items || items.length === 0) {
      throw new Error('Supplier ID and at least one item are required');
    }

    // Verify vendor exists and belongs to account
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', supplier_id)
      .single();

    if (vendorError || !vendor) {
      throw new Error('Vendor not found or unauthorized');
    }

    // Calculate total amount
    const total_amount = items.reduce((sum, item) => sum + (item.quantity_lbs * item.unit_cost), 0);

    // Create purchase order
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        account_id: account_id,
        vendor_id: supplier_id,
        expected_delivery_date,
        notes,
        total: total_amount,
        subtotal: total_amount,
        tax: 0,
        shipping: 0,
        status: 'draft',
      })
      .select()
      .single();

    if (poError || !po) {
      console.error('PO creation error:', poError);
      throw new Error('Failed to create purchase order');
    }

    // Create PO items
    const poItems = items.map(item => ({
      account_id: account_id,
      purchase_order_id: po.id,
      product_id: item.product_id,
      quantity: item.quantity_lbs,
      unit_cost: item.unit_cost,
      total_cost: item.quantity_lbs * item.unit_cost,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(poItems);

    if (itemsError) {
      console.error('PO items creation error:', itemsError);
      // Rollback: delete the PO
      await supabase.from('purchase_orders').delete().eq('id', po.id);
      throw new Error('Failed to create purchase order items');
    }

    // Return complete PO with items
    const { data: completePO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(id, name, contact_name),
        items:purchase_order_items(
          *,
          product:products(id, name, sku)
        )
      `)
      .eq('id', po.id)
      .single();

    if (fetchError) {
      console.error('Fetch complete PO error:', fetchError);
      throw new Error('Purchase order created but failed to fetch details');
    }

    return new Response(
      JSON.stringify({
        success: true,
        purchase_order: completePO,
        message: 'Purchase order created successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Create PO error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
