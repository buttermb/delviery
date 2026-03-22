import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { consumeCreditsForAction, trackCreditEvent } from '../_shared/creditGate.ts';

/**
 * Map legacy automation rule identifiers to credit action keys.
 * Each rule type incurs a different credit cost when executed.
 *
 *   low_stock_alert    → alert_triggered  (10 credits)
 *   daily_revenue_summary → automation_run (10 credits)
 *
 * Paid-tier tenants skip credit deduction entirely.
 */
const RULE_CREDIT_KEY: Record<string, string> = {
  low_stock_alert: 'alert_triggered',
  daily_revenue_summary: 'automation_run',
};

interface TenantResult {
  tenant: string;
  actions: string[];
  creditsConsumed: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch tenants with automation settings and free-tier status
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(`
        id,
        business_name,
        is_free_tier,
        tenant_settings ( automation_rules )
      `);

    if (tenantsError) throw tenantsError;

    const results: TenantResult[] = [];

    for (const tenant of tenants || []) {
      const settings = Array.isArray(tenant.tenant_settings)
        ? tenant.tenant_settings[0]
        : tenant.tenant_settings;

      if (!settings?.automation_rules?.enabled) continue;

      const rules: string[] = settings.automation_rules.rules || [];
      if (rules.length === 0) continue;

      const isFreeTier = tenant.is_free_tier ?? false;
      const tenantResult: TenantResult = {
        tenant: tenant.business_name,
        actions: [],
        creditsConsumed: 0,
      };

      // --- Low Stock Alert ---
      if (rules.includes('low_stock_alert')) {
        const consumed = await deductRuleCredits(
          supabase,
          tenant.id,
          isFreeTier,
          'low_stock_alert',
          tenantResult,
        );
        if (!consumed) {
          results.push(tenantResult);
          continue;
        }

        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .lt('stock_quantity', 10)
          .gt('stock_quantity', 0);

        if (count && count > 0) {
          await supabase.from('activity_logs').insert({
            tenant_id: tenant.id,
            action: 'automation_alert',
            resource: 'inventory',
            details: {
              type: 'low_stock',
              count,
              message: `${count} items are running low on stock.`,
            },
          });
          tenantResult.actions.push(`Logged low stock alert for ${count} items`);
        }
      }

      // --- Daily Revenue Summary ---
      if (rules.includes('daily_revenue_summary')) {
        const consumed = await deductRuleCredits(
          supabase,
          tenant.id,
          isFreeTier,
          'daily_revenue_summary',
          tenantResult,
        );
        if (!consumed) {
          results.push(tenantResult);
          continue;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: orders } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', today.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")');

        const revenue =
          orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

        if (revenue > 0) {
          await supabase.from('activity_logs').insert({
            tenant_id: tenant.id,
            action: 'automation_summary',
            resource: 'finance',
            details: {
              type: 'daily_revenue',
              amount: revenue,
              message: `Daily revenue summary: $${revenue.toLocaleString()}`,
            },
          });
          tenantResult.actions.push(`Logged daily revenue: $${revenue}`);
        }
      }

      if (tenantResult.actions.length > 0 || tenantResult.creditsConsumed > 0) {
        results.push(tenantResult);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

/**
 * Deduct credits for a single automation rule execution.
 * Paid-tier tenants are not charged.
 *
 * @returns true if the rule can proceed, false if insufficient credits.
 */
async function deductRuleCredits(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tenantId: string,
  isFreeTier: boolean,
  ruleName: string,
  tenantResult: TenantResult,
): Promise<boolean> {
  // Paid tiers skip credit checks
  if (!isFreeTier) return true;

  const actionKey = RULE_CREDIT_KEY[ruleName];
  if (!actionKey) return true; // Unknown rule — allow through

  const dateKey = new Date().toISOString().slice(0, 10);
  const creditResult = await consumeCreditsForAction(
    supabase,
    tenantId,
    actionKey,
    `${ruleName}-${tenantId}-${dateKey}`,
    'automation',
    `Automation rule: ${ruleName}`,
  );

  if (!creditResult.success) {
    await trackCreditEvent(
      supabase,
      tenantId,
      'action_blocked_insufficient_credits',
      creditResult.newBalance,
      actionKey,
      { ruleName, errorMessage: creditResult.errorMessage },
    );

    tenantResult.actions.push(
      `Skipped ${ruleName} — insufficient credits (balance: ${creditResult.newBalance})`,
    );
    return false;
  }

  tenantResult.creditsConsumed += creditResult.creditsCost;
  return true;
}
