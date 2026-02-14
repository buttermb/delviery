/**
 * Quick Actions Component
 * Reusable quick action buttons for dashboards and pages
 */

import { Button } from '@/components/ui/button';
import { Package, FileText, Truck, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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
    href: '/admin/big-plug-order',
    variant: 'default',
  },
  {
    label: 'Create Menu',
    icon: <Menu className="h-4 w-4" />,
    href: '/admin/disposable-menus',
    variant: 'default',
  },
  {
    label: 'Receive Inventory',
    icon: <Package className="h-4 w-4" />,
    href: '/admin/operations/receiving',
    variant: 'outline',
  },
  {
    label: 'Create Transfer',
    icon: <Truck className="h-4 w-4" />,
    href: '/admin/inventory/dispatch',
    variant: 'outline',
  },
];

export function QuickActions({ actions = defaultActions, className }: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || 'default'}
          onClick={() => navigate(action.href)}
          className="gap-2"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

