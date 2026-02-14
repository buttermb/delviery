/**
 * Quick Actions Bar - Fast access to common actions
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Package, Menu, FileText } from 'lucide-react';
import { useTenantNavigation } from '@/hooks/useTenantNavigation';

export function QuickActionsBar() {
  const { navigateToAdmin } = useTenantNavigation();

  const actions = [
    {
      label: 'New Order',
      icon: <Package className="h-4 w-4" />,
      href: 'wholesale-orders',
      shortcut: '⌘N',
    },
    {
      label: 'Create Menu',
      icon: <Menu className="h-4 w-4" />,
      href: 'disposable-menus?action=create',
      shortcut: '⌘M',
    },
    {
      label: 'Receive Inventory',
      icon: <Plus className="h-4 w-4" />,
      href: 'inventory/products',
      shortcut: '⌘R',
    },
    {
      label: 'Print Labels',
      icon: <FileText className="h-4 w-4" />,
      href: 'generate-barcodes',
      shortcut: '⌘P',
    },
  ];

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:gap-3 sm:flex-wrap">
        <span className="text-sm font-medium text-muted-foreground hidden sm:inline">Quick Actions:</span>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap sm:gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => navigateToAdmin(action.href)}
              className="gap-2 min-h-[44px] justify-start sm:justify-center w-full sm:w-auto"
            >
              {action.icon}
              <span className="truncate">{action.label}</span>
              <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 ml-auto sm:ml-2">
                {action.shortcut}
              </kbd>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

