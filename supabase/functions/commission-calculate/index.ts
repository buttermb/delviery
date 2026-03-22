import { createClient, corsHeaders } from '../_shared/deps.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

const COMMISSION_RATE = 0.02; // 2% commission

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return withCreditGate(req, CREDIT_ACTIONS.COMMISSION_CALCULATE, async (tenantId, serviceClient) => {
    try {
      const body = await req.json();
      const { order_ids, date_from, date_to } = body as {
        order_ids?: string[];
        date_from?: string;
        date_to?: string;
      };

      // Build query for confirmed orders that need commission calculation
      let query = serviceClient
        .from('menu_orders')
        .select('id, total_amount, status, menu_id, created_at')
        .eq('status', 'confirmed');

      // Filter by tenant's menus
      const { data: tenantMenus, error: menuError } = await serviceClient
        .from('disposable_menus')
        .select('id')
        .eq('tenant_id', tenantId);

      if (menuError) {
        throw new Error(`Failed to fetch tenant menus: ${menuError.message}`);
      }

      if (!tenantMenus || tenantMenus.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            calculated: 0,
            skipped: 0,
            total_commission: 0,
            message: 'No menus found for this tenant',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const menuIds = tenantMenus.map((m) => m.id);
      query = query.in('menu_id', menuIds);

      // Apply optional filters
      if (order_ids && order_ids.length > 0) {
        query = query.in('id', order_ids);
      }
      if (date_from) {
        query = query.gte('created_at', date_from);
      }
      if (date_to) {
        query = query.lte('created_at', date_to);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      if (!orders || orders.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            calculated: 0,
            skipped: 0,
            total_commission: 0,
            message: 'No matching confirmed orders found',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get existing commission records to avoid duplicates
      const orderIds = orders.map((o) => o.id);
      const { data: existingCommissions } = await serviceClient
        .from('commission_transactions')
        .select('order_id')
        .eq('tenant_id', tenantId)
        .in('order_id', orderIds);

      const existingOrderIds = new Set(
        (existingCommissions ?? []).map((c) => c.order_id)
      );

      // Calculate commissions for orders that don't already have one
      const newCommissions = orders
        .filter((order) => !existingOrderIds.has(order.id))
        .filter((order) => order.total_amount > 0)
        .map((order) => ({
          tenant_id: tenantId,
          order_id: order.id,
          customer_payment_amount: order.total_amount,
          commission_rate: COMMISSION_RATE * 100, // Store as percentage (2.00)
          commission_amount: Number((order.total_amount * COMMISSION_RATE).toFixed(2)),
          status: 'pending' as const,
        }));

      let insertedCount = 0;
      let totalCommission = 0;

      if (newCommissions.length > 0) {
        const { error: insertError } = await serviceClient
          .from('commission_transactions')
          .insert(newCommissions);

        if (insertError) {
          throw new Error(`Failed to insert commissions: ${insertError.message}`);
        }

        insertedCount = newCommissions.length;
        totalCommission = newCommissions.reduce(
          (sum, c) => sum + c.commission_amount,
          0
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          calculated: insertedCount,
          skipped: existingOrderIds.size,
          total_commission: totalCommission,
          message: `Calculated ${insertedCount} new commissions, skipped ${existingOrderIds.size} existing`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Commission calculation failed:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Commission calculation failed',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  });
});
