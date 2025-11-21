
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OmniChannelMessenger } from '../messaging/omni-channel.ts';

export class InventorySync {
    private supabase;
    private messenger: OmniChannelMessenger;

    constructor(supabaseUrl: string, supabaseKey: string) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.messenger = OmniChannelMessenger.getInstance();
    }

    async syncWithPOS(tenantId: string) {
        // Subscribe to POS inventory changes
        const subscription = this.supabase
            .channel('inventory-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'wholesale_inventory',
                    filter: `tenant_id=eq.${tenantId}`
                },
                async (payload: any) => {
                    await this.handleInventoryChange(payload);
                }
            )
            .subscribe();

        console.log(`Subscribed to inventory changes for tenant ${tenantId}`);
    }

    async handleInventoryChange(payload: any) {
        const { eventType, new: newData, old: oldData } = payload;

        if (!newData) return; // Deletion or error

        console.log(`Inventory change detected for product ${newData.id}: ${eventType}`);

        // Find affected menus
        const affectedMenus = await this.getMenusWithProduct(newData.id);

        for (const menu of affectedMenus) {
            if (newData.available_quantity <= 0) {
                // Remove from menu or mark as out of stock
                await this.updateMenuProduct(menu.id, newData.id, {
                    display_availability: false,
                    custom_message: 'Currently out of stock'
                });
                console.log(`Marked product ${newData.id} as out of stock in menu ${menu.id}`);
            } else if ((!oldData || oldData.available_quantity <= 0) && newData.available_quantity > 0) {
                // Back in stock - notify customers who might be interested (placeholder logic)
                // await this.notifyBackInStock(menu.id, newData.id);

                // Update menu to show availability
                await this.updateMenuProduct(menu.id, newData.id, {
                    display_availability: true,
                    custom_message: null
                });
                console.log(`Marked product ${newData.id} as back in stock in menu ${menu.id}`);
            }
        }
    }

    private async getMenusWithProduct(productId: string): Promise<any[]> {
        // This would query the database to find which menus contain this product
        // For MVP, we'll mock or assume a simple query
        const { data, error } = await this.supabase
            .from('disposable_menu_products_decrypted')
            .select('menu_id')
            .eq('product_id', productId);

        if (error) {
            console.error("Error fetching menus for product:", error);
            return [];
        }

        // Get unique menu IDs
        const menuIds = [...new Set(data.map((item: any) => item.menu_id))];
        return menuIds.map(id => ({ id }));
    }

    private async updateMenuProduct(menuId: string, productId: string, updates: any) {
        // Update the specific product entry in the menu
        // Note: This assumes we can update the decrypted table or the source JSON
        // For MVP, let's assume we update a status field in the link table
        const { error } = await this.supabase
            .from('disposable_menu_products') // Assuming this is the link table
            .update(updates)
            .eq('menu_id', menuId)
            .eq('product_id', productId);

        if (error) {
            console.error(`Failed to update menu product ${productId} in menu ${menuId}:`, error);
        }
    }
}
