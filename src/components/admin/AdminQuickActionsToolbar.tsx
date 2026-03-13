import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShoppingCart, Package, Users, Menu as MenuIcon, X } from 'lucide-react';

import { useTenantContext } from '@/hooks/useTenantContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { logger } from '@/lib/logger';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-order',
    label: 'New Order',
    icon: ShoppingCart,
    path: '/admin/orders?action=new',
    color: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    id: 'new-product',
    label: 'New Product',
    icon: Package,
    path: '/admin/inventory-hub?action=new',
    color: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    id: 'new-customer',
    label: 'New Customer',
    icon: Users,
    path: '/admin/customer-hub?action=new',
    color: 'bg-purple-600 hover:bg-purple-700',
  },
  {
    id: 'new-menu',
    label: 'New Menu',
    icon: MenuIcon,
    path: '/admin/inventory-hub?tab=menus&action=new',
    color: 'bg-orange-600 hover:bg-orange-700',
  },
];

export function AdminQuickActionsToolbar() {
  const { tenantSlug, hasPermission } = useTenantContext();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAction = (action: QuickAction) => {
    logger.info('[QuickActions] Action clicked', { actionId: action.id });

    if (tenantSlug) {
      navigate(`/${tenantSlug}${action.path}`);
      setIsExpanded(false);
    }
  };

  // Filter actions based on permissions
  const availableActions = QUICK_ACTIONS.filter((action) => {
    switch (action.id) {
      case 'new-order':
        return hasPermission('manage:orders');
      case 'new-product':
        return hasPermission('manage:products');
      case 'new-customer':
        return hasPermission('manage:customers');
      case 'new-menu':
        return hasPermission('manage:menus');
      default:
        return false;
    }
  });

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <TooltipProvider>
        <div className="flex flex-col items-end gap-2">
          {isExpanded && (
            <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-2">
              {availableActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <Button
                        size="lg"
                        className={`${action.color} text-white shadow-lg hover:shadow-xl transition-all gap-2`}
                        onClick={() => handleAction(action)}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="hidden sm:inline">{action.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>{action.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl transition-all w-14 h-14 rounded-full p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <X className="h-6 w-6" />
            ) : (
              <Plus className="h-6 w-6" />
            )}
          </Button>
        </div>
      </TooltipProvider>
    </div>
  );
}
