import { supabase } from '@/integrations/supabase/client';

export interface AutomationResult {
    ruleId: string;
    triggered: boolean;
    message?: string;
    action?: string;
    data?: unknown;
}

/**
 * Process client-side automation rules
 * These are rules that provide immediate feedback to the user in the UI
 */
export async function processAutomationRules(
    tenantId: string,
    enabledRules: string[]
): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];

    if (!tenantId || !enabledRules || enabledRules.length === 0) {
        return results;
    }

    // Rule: Low Stock Alert (Client-side check for immediate toast)
    if (enabledRules.includes('low_stock_alert')) {
        const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .lt('stock_quantity', 10)
            .gt('stock_quantity', 0);

        if (count && count > 0) {
            results.push({
                ruleId: 'low_stock_alert',
                triggered: true,
                message: `${count} ${count === 1 ? 'item is' : 'items are'} running low on stock.`,
                action: '/admin/inventory-hub',
                data: { count }
            });
        }
    }

    // Rule: Compliance Reminders
    if (enabledRules.includes('compliance_reminders')) {
        // Check for compliance documents expiring in the next 30 days
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const { count } = await supabase
            .from('compliance_documents')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .lte('expiration_date', thirtyDaysFromNow.toISOString())
            .gte('expiration_date', new Date().toISOString()); // Only future expirations

        if (count && count > 0) {
            results.push({
                ruleId: 'compliance_reminders',
                triggered: true,
                message: `You have ${count} compliance document${count === 1 ? '' : 's'} expiring soon.`,
                action: '/admin/compliance'
            });
        }
    }

    return results;
}
