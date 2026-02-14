
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface MenuEvent {
    type: 'MENU_CREATED' | 'MENU_ACCESSED' | 'MENU_BURNED' |
    'ORDER_PLACED' | 'SECURITY_BREACH' | 'INVENTORY_CHANGED';
    payload: any;
    timestamp: Date;
    tenantId: string;
    menuId?: string;
}

export class MenuEventProcessor {
    private supabase;

    constructor(supabaseUrl: string, supabaseKey: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async process(event: MenuEvent) {
        console.log(`Processing event: ${event.type}`, event);

        // Log event to database
        await this.logEvent(event);

        switch (event.type) {
            case 'MENU_ACCESSED':
                await this.handleMenuAccessed(event);
                break;
            case 'SECURITY_BREACH':
                await this.handleSecurityBreach(event);
                break;
            case 'ORDER_PLACED':
                await this.handleOrderPlaced(event);
                break;
            case 'MENU_BURNED':
                await this.handleMenuBurned(event);
                break;
            // Add other handlers as needed
        }
    }

    private async logEvent(event: MenuEvent) {
        try {
            // Assuming a table 'menu_events_log' exists or will be created
            // For now, we can log to console or a generic logs table if specific one doesn't exist
            // In a real implementation, this would go to a dedicated events table
            console.log("Logging event to DB:", event);
        } catch (error) {
            console.error("Error logging event:", error);
        }
    }

    private async handleMenuAccessed(event: MenuEvent) {
        // Logic for tracking access, updating analytics, etc.
        console.log("Handling menu access:", event.payload);
    }

    private async handleSecurityBreach(event: MenuEvent) {
        console.log("CRITICAL: Security breach detected!", event.payload);
        // 1. Auto-burn menu if needed
        if (event.menuId) {
            await this.autoBurnMenu(event.menuId, "Security Breach");
        }
        // 2. Notify admin (placeholder)
        await this.notifyAdmin(event);
    }

    private async handleOrderPlaced(event: MenuEvent) {
        console.log("Order placed:", event.payload);
        // Logic to update inventory, notify kitchen, etc.
    }

    private async handleMenuBurned(event: MenuEvent) {
        console.log("Menu burned:", event.menuId);
        // Logic to clean up cache, notify user, etc.
    }

    private async autoBurnMenu(menuId: string, reason: string) {
        console.log(`Auto-burning menu ${menuId} due to: ${reason}`);
        const { error } = await this.supabase
            .from('disposable_menus')
            .update({
                status: 'burned',
                burn_reason: reason,
                burned_at: new Date().toISOString()
            })
            .eq('id', menuId);

        if (error) {
            console.error("Failed to auto-burn menu:", error);
        }
    }

    private async notifyAdmin(event: MenuEvent) {
        // Placeholder for notification logic (SMS, Email, etc.)
        console.log("Notifying admin about:", event.type);
    }
}
