/**
 * Dashboard Quick Actions Panel
 *
 * Permission-gated quick action buttons for common dashboard operations:
 * Create Order, Add Product, Send Broadcast, Generate Report.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Megaphone, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface QuickAction {
  id: string;
  label: string;
  icon: typeof ShoppingCart;
  permission: string;
  path: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-order',
    label: 'Create Order',
    icon: ShoppingCart,
    permission: 'orders:create',
    path: 'orders',
  },
  {
    id: 'add-product',
    label: 'Add Product',
    icon: Package,
    permission: 'products:create',
    path: 'inventory/products',
  },
  {
    id: 'send-broadcast',
    label: 'Send Broadcast',
    icon: Megaphone,
    permission: 'customers:edit',
    path: 'marketing-hub?tab=campaigns',
  },
  {
    id: 'generate-report',
    label: 'Generate Report',
    icon: FileBarChart,
    permission: 'reports:export',
    path: 'reports',
  },
];

interface DashboardQuickActionsPanelProps {
  className?: string;
}

export function DashboardQuickActionsPanel({ className }: DashboardQuickActionsPanelProps) {
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const { hasPermission, isLoading } = usePermissions();

  const visibleActions = QUICK_ACTIONS.filter(
    (action) => hasPermission(action.permission)
  );

  if (isLoading || visibleActions.length === 0) {
    return null;
  }

  const handleActionClick = (action: QuickAction) => {
    navigate(`/${tenant?.slug}/admin/${action.path}`);
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base font-medium">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                className={cn(
                  'h-auto flex-col gap-2 py-4 px-3',
                  'hover:bg-accent hover:border-primary/20',
                  'min-h-[44px] touch-manipulation',
                  'transition-colors duration-150'
                )}
                onClick={() => handleActionClick(action)}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-center">
                  {action.label}
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
