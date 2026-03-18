/**
 * Quick Actions Component
 * Reusable quick action buttons for dashboards and pages
 */

import { Button } from '@/components/ui/button';
import { Package, FileText, Truck, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  href: string;
  variant?: 'default' | 'outline' | 'secondary';
}

interface QuickActionsProps {
  actions?: QuickAction[];
  className?: string;
}

const defaultActions: QuickAction[] = [
  {
    label: 'New Order',
    icon: <FileText className="h-4 w-4" />,
    href: 'big-plug-order',
    variant: 'default',
  },
  {
    label: 'Create Menu',
    icon: <Menu className="h-4 w-4" />,
    href: 'disposable-menus',
    variant: 'default',
  },
  {
    label: 'Receive Inventory',
    icon: <Package className="h-4 w-4" />,
    href: 'operations/receiving',
    variant: 'outline',
  },
  {
    label: 'Create Transfer',
    icon: <Truck className="h-4 w-4" />,
    href: 'inventory/dispatch',
    variant: 'outline',
  },
];

export function QuickActions({ actions = defaultActions, className }: QuickActionsProps) {
  const { navigateToAdmin } = useTenantNavigation();

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || 'default'}
          onClick={() => navigateToAdmin(action.href)}
          className="gap-2"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

