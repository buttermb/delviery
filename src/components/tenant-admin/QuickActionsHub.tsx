/**
 * Quick Actions Hub
 * Central command panel for the 10 most common daily business tasks
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Package,
    Truck,
    UserPlus,
    FileText,
    Smartphone,
    MapPin,
    ShoppingCart,
    AlertCircle,
    MessageSquare
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ElementType;
    action: () => void;
    badge?: number;
    shortcut?: string;
    description: string;
}

export function QuickActionsHub() {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    // Fetch counts for badges
    const { data: counts } = useQuery({
        queryKey: ['quick-actions-counts', tenantId],
        queryFn: async () => {
            if (!tenantId) return { pendingOrders: 0, lowStockItems: 0, todayDeliveries: 0 };

            // Get pending orders count
            const { count: pendingOrders } = await supabase
                .from('wholesale_orders')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .eq('status', 'pending');

            // Get low stock items count
            const { data: inventory } = await supabase
                .from('wholesale_inventory')
                .select('quantity_lbs, reorder_point')
                .eq('tenant_id', tenantId);

            const lowStockItems = inventory?.filter(
                item => (item.quantity_lbs || 0) <= (item.reorder_point || 0)
            ).length || 0;

            // Get today's deliveries count (orders ready for delivery)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { count: todayDeliveries } = await supabase
                .from('wholesale_orders')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenantId)
                .eq('status', 'ready')
                .gte('created_at', today.toISOString());

            return {
                pendingOrders: pendingOrders || 0,
                lowStockItems,
                todayDeliveries: todayDeliveries || 0
            };
        },
        enabled: !!tenantId,
        refetchInterval: 30000 // Refresh every 30 seconds
    });

    const quickActions: QuickAction[] = [
        {
            id: 'new-order',
            label: 'New Order',
            icon: Plus,
            action: () => navigate(`/${tenantSlug}/admin/wholesale-orders/new`),
            shortcut: 'Alt+N',
            description: 'Create wholesale order'
        },
        {
            id: 'add-inventory',
            label: 'Add Inventory',
            icon: Package,
            action: () => navigate(`/${tenantSlug}/admin/advanced-inventory`),
            shortcut: 'Alt+I',
            description: 'Update stock levels'
        },
        {
            id: 'mark-shipped',
            label: 'Mark Shipped',
            icon: Truck,
            action: () => navigate(`/${tenantSlug}/admin/wholesale-orders?status=ready`),
            badge: counts?.todayDeliveries,
            description: 'Process deliveries'
        },
        {
            id: 'add-customer',
            label: 'Add Customer',
            icon: UserPlus,
            action: () => navigate(`/${tenantSlug}/admin/big-plug-clients`),
            shortcut: 'Alt+C',
            description: 'Create customer profile'
        },
        {
            id: 'generate-invoice',
            label: 'Invoice',
            icon: FileText,
            action: () => navigate(`/${tenantSlug}/admin/crm/invoices/new`),
            description: 'Generate customer invoice'
        },
        {
            id: 'create-menu',
            label: 'Disposable Menu',
            icon: Smartphone,
            action: () => navigate(`/${tenantSlug}/admin/disposable-menus`),
            description: 'Create QR menu'
        },
        {
            id: 'view-deliveries',
            label: 'Deliveries',
            icon: MapPin,
            action: () => navigate(`/${tenantSlug}/admin/delivery-management`),
            badge: counts?.todayDeliveries,
            description: "View today's routes"
        },
        {
            id: 'open-pos',
            label: 'Open POS',
            icon: ShoppingCart,
            action: () => navigate(`/${tenantSlug}/admin/pos-system`),
            shortcut: 'Alt+P',
            description: 'Open cash register'
        },
        {
            id: 'low-stock',
            label: 'Low Stock',
            icon: AlertCircle,
            action: () => navigate(`/${tenantSlug}/admin/inventory-monitoring`),
            badge: counts?.lowStockItems,
            description: 'Review reorder needs'
        },
        {
            id: 'send-message',
            label: 'Message',
            icon: MessageSquare,
            action: () => navigate(`/${tenantSlug}/admin/big-plug-clients`),
            description: 'Send customer SMS'
        }
    ];

    // Register keyboard shortcuts
    // TODO: Implement useEffect with keyboard event listeners

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Quick Actions
                    <Badge variant="outline" className="ml-auto text-xs">Alt+Q</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Button
                                key={action.id}
                                variant="outline"
                                className="h-auto flex-col gap-2 p-4 relative hover:bg-primary/5 hover:border-primary/50 transition-all"
                                onClick={action.action}
                                title={action.description}
                            >
                                {action.badge !== undefined && action.badge > 0 && (
                                    <Badge
                                        variant="destructive"
                                        className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center"
                                    >
                                        {action.badge}
                                    </Badge>
                                )}
                                <Icon className="h-5 w-5" />
                                <span className="text-xs font-medium text-center leading-tight">
                                    {action.label}
                                </span>
                                {action.shortcut && (
                                    <span className="text-[10px] text-muted-foreground">
                                        {action.shortcut}
                                    </span>
                                )}
                            </Button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
