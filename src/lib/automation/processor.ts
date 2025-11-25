import { supabase } from '@/integrations/supabase/client';

export interface AutomationResult {
    ruleId: string;
    triggered: boolean;
    message?: string;
    action?: string;
    data?: any;
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
                message: `${count} items are running low on stock.`,
                action: '/admin/inventory-dashboard',
                data: { count }
            });
        }
    }

    // Rule: Compliance Reminders
    if (enabledRules.includes('compliance_reminders')) {
        // Mock check for compliance documents expiring
        // In a real app, this would check a compliance table
        // @ts-ignore
        const { count } = await supabase
            .from('activity_logs')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('action', 'compliance_expiry')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (count && count > 0) {
            results.push({
                ruleId: 'compliance_reminders',
                triggered: true,
                message: 'You have compliance documents expiring soon.',
                action: '/admin/compliance'
            });
        }
    }

    return results;
}
