
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { VelocityChecker } from '../../../supabase/functions/_shared/velocity-check.ts';
import { AISecurityMonitor } from './ai-monitor.ts';

interface BurnCondition {
    type: 'velocity' | 'pattern' | 'schedule' | 'threshold';
    evaluate: (menu: any, context: any) => Promise<boolean>;
    action: 'soft_burn' | 'hard_burn';
    notification: boolean;
}

export class AutoBurnEngine {
    private conditions: BurnCondition[];
    private supabase;
    private velocityChecker: VelocityChecker;
    private aiMonitor: AISecurityMonitor;

    constructor(supabaseUrl: string, supabaseKey: string, redisConfig: any) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.velocityChecker = new VelocityChecker(redisConfig.hostname, redisConfig.port, redisConfig.password);
        this.aiMonitor = AISecurityMonitor.getInstance();

        this.conditions = [
            {
                type: 'velocity',
                evaluate: async (menu, context) => {
                    // Check if velocity exceeds hard limit
                    const check = await this.velocityChecker.checkVelocity(menu.id, context.ip);
                    return !check.allowed && check.action === 'hard_burn';
                },
                action: 'hard_burn',
                notification: true
            },
            {
                type: 'pattern',
                evaluate: async (menu, context) => {
                    const patterns = await this.aiMonitor.analyzeAccessPattern(menu.id, context.logs);
                    return patterns.some(p => p.severity === 'critical');
                },
                action: 'hard_burn',
                notification: true
            },
            {
                type: 'schedule',
                evaluate: async (menu, context) => {
                    if (!menu.auto_burn_hours) return false;
                    const createdAt = new Date(menu.created_at);
                    const burnTime = new Date(createdAt.getTime() + menu.auto_burn_hours * 60 * 60 * 1000);
                    return new Date() >= burnTime;
                },
                action: 'hard_burn',
                notification: false // Expected behavior
            }
        ];
    }

    async evaluateMenu(menuId: string, context: any) {
        const { data: menu, error } = await this.supabase
            .from('disposable_menus')
            .select('*')
            .eq('id', menuId)
            .single();

        if (error || !menu) return;

        for (const condition of this.conditions) {
            if (await condition.evaluate(menu, context)) {
                await this.executeBurn(menu, condition);
                break;
            }
        }
    }

    private async executeBurn(menu: any, condition: BurnCondition) {
        console.log(`Executing ${condition.action} for menu ${menu.id} due to ${condition.type}`);

        const status = condition.action === 'soft_burn' ? 'soft_burned' : 'burned';

        await this.supabase
            .from('disposable_menus')
            .update({
                status: status,
                burned_at: new Date().toISOString(),
                burn_reason: `Auto-burn: ${condition.type}`
            })
            .eq('id', menu.id);

        if (condition.notification) {
            // Notify admin
            console.log("Sending notification for auto-burn");
        }
    }
}
