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
import { useEffect, useMemo } from 'react';
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

            // Get low stock items count from products table
            const { data: products } = await supabase
                .from('products')
                .select('available_quantity, stock_quantity, low_stock_alert')
                .eq('tenant_id', tenantId);

            const DEFAULT_LOW_STOCK_THRESHOLD = 10;
            const lowStockItems = products?.filter(item => {
                const currentQty = item.available_quantity ?? item.stock_quantity ?? 0;
                const threshold = item.low_stock_alert ?? DEFAULT_LOW_STOCK_THRESHOLD;
                return currentQty <= threshold;
            }).length || 0;

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

    const quickActions: QuickAction[] = useMemo(() => [
        {
            id: 'new-order',
            label: 'New Order',
            icon: Plus,
            action: () => navigate(`/${tenantSlug}/admin/orders?tab=wholesale&action=new`),
            shortcut: 'Alt+N',
            description: 'Create wholesale order'
        },
        {
            id: 'add-inventory',
            label: 'Add Inventory',
            icon: Package,
            action: () => navigate(`/${tenantSlug}/admin/inventory-hub?tab=adjustments`),
            shortcut: 'Alt+I',
            description: 'Update stock levels'
        },
        {
            id: 'mark-shipped',
            label: 'Mark Shipped',
            icon: Truck,
            action: () => navigate(`/${tenantSlug}/admin/orders?tab=wholesale&status=ready`),
            badge: counts?.todayDeliveries,
            description: 'Process deliveries'
        },
        {
            id: 'add-customer',
            label: 'Add Customer',
            icon: UserPlus,
            action: () => navigate(`/${tenantSlug}/admin/customer-hub?tab=contacts&action=new`),
            shortcut: 'Alt+C',
            description: 'Create customer profile'
        },
        {
            id: 'generate-invoice',
            label: 'Invoice',
            icon: FileText,
            action: () => navigate(`/${tenantSlug}/admin/customer-hub?tab=invoices&action=new`),
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
            action: () => navigate(`/${tenantSlug}/admin/delivery-hub`),
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
            action: () => navigate(`/${tenantSlug}/admin/inventory-hub?tab=monitoring`),
            badge: counts?.lowStockItems,
            description: 'Review reorder needs'
        },
        {
            id: 'send-message',
            label: 'Message',
            icon: MessageSquare,
            action: () => navigate(`/${tenantSlug}/admin/notifications`),
            description: 'Send SMS/notifications'
        }
    ], [navigate, tenantSlug, counts]);

    // Register keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (!e.altKey) return;

            // Handle Alt + Key shortcuts
            const key = e.key.toUpperCase();
            const action = quickActions.find(a => a.shortcut === `Alt+${key}`);

            if (action) {
                e.preventDefault();
                action.action();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [quickActions]);


    return (
        <Card className="glass-card">
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
                                className="h-auto flex-col gap-2 p-4 relative bg-background/50 hover:bg-primary/10 border-white/10 hover:border-primary/50 transition-all backdrop-blur-sm"
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
