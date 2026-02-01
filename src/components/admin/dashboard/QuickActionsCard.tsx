/**
 * Quick Actions Card
 * Dashboard card with buttons for common actions: new order, product, customer
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Package, Users, FileText } from 'lucide-react';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
  description: string;
}

interface QuickActionsCardProps {
  className?: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'new-order',
    label: 'New Order',
    icon: FileText,
    path: '/admin/orders?tab=wholesale&action=new',
    color: 'text-blue-500',
    description: 'Create a new wholesale order',
  },
  {
    id: 'new-product',
    label: 'New Product',
    icon: Package,
    path: '/admin/products?action=new',
    color: 'text-emerald-500',
    description: 'Add a new product to inventory',
  },
  {
    id: 'new-customer',
    label: 'New Customer',
    icon: Users,
    path: '/admin/customer-hub?tab=contacts&action=new',
    color: 'text-purple-500',
    description: 'Create a new customer profile',
  },
];

export function QuickActionsCard({ className }: QuickActionsCardProps) {
  const navigate = useTenantNavigate();

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Plus className="h-4 w-4 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                className={cn(
                  'h-auto flex-col gap-2 py-4 px-3',
                  'hover:bg-accent hover:border-primary/20',
                  'transition-all duration-200'
                )}
                onClick={() => navigate(action.path)}
                title={action.description}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    'bg-primary/10'
                  )}
                >
                  <Icon className={cn('h-5 w-5', action.color)} />
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
