/**
 * Quick Actions Bar - Fast access to common actions
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Package, Menu, Truck, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function QuickActionsBar() {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'New Order',
      icon: <Package className="h-4 w-4" />,
      href: '/admin/wholesale-orders',
      shortcut: '⌘N',
    },
    {
      label: 'Create Menu',
      icon: <Menu className="h-4 w-4" />,
      href: '/admin/disposable-menus?action=create',
      shortcut: '⌘M',
    },
    {
      label: 'Receive Inventory',
      icon: <Plus className="h-4 w-4" />,
      href: '/admin/inventory/products',
      shortcut: '⌘R',
    },
    {
      label: 'Print Labels',
      icon: <FileText className="h-4 w-4" />,
      href: '/admin/generate-barcodes',
      shortcut: '⌘P',
    },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Quick Actions:</span>
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            onClick={() => navigate(action.href)}
            className="gap-2"
          >
            {action.icon}
            <span>{action.label}</span>
            <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              {action.shortcut}
            </kbd>
          </Button>
        ))}
      </div>
    </Card>
  );
}

