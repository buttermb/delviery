import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, AlertCircle, Clock, FileText, Package } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskItem {
  id: string;
  type: 'approval' | 'expiring' | 'overdue';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  path: string;
}

function getPriorityColor(priority: TaskItem['priority']) {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
}

function getTaskIcon(type: TaskItem['type']) {
  switch (type) {
    case 'approval':
      return <CheckSquare className="h-4 w-4 text-emerald-600" />;
    case 'expiring':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'overdue':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
  }
}

export function AdminTaskListWidget() {
  const { tenantId, tenantSlug, isReady } = useTenantContext();
  const navigate = useNavigate();

  const { data: tasks, isLoading } = useQuery({
    queryKey: queryKeys.admin.tasks(tenantId ?? ''),
    queryFn: async (): Promise<TaskItem[]> => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      logger.info('[TaskList] Fetching pending tasks', { tenantId });

      const taskItems: TaskItem[] = [];

      // Check for overdue invoices
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, customer_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'overdue')
        .limit(5);

      if (overdueInvoices && overdueInvoices.length > 0) {
        overdueInvoices.forEach((invoice) => {
          taskItems.push({
            id: `invoice-${invoice.id}`,
            type: 'overdue',
            title: `Overdue Invoice ${invoice.invoice_number}`,
            description: 'Payment is past due',
            priority: 'high',
            path: `/${tenantSlug}/admin/invoices/${invoice.id}`,
          });
        });
      }

      // Check for expiring products (low stock)
      const { data: lowStockProducts } = await supabase
        .from('products')
        .select('id, name, stock_quantity')
        .eq('tenant_id', tenantId)
        .lte('stock_quantity', 10)
        .limit(5);

      if (lowStockProducts && lowStockProducts.length > 0) {
        lowStockProducts.forEach((product) => {
          taskItems.push({
            id: `product-${product.id}`,
            type: 'expiring',
            title: `Low Stock: ${product.name}`,
            description: `Only ${product.stock_quantity} units remaining`,
            priority: 'medium',
            path: `/${tenantSlug}/admin/products/${product.id}`,
          });
        });
      }

      // Check for pending orders (requiring approval)
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .limit(5);

      if (pendingOrders && pendingOrders.length > 0) {
        pendingOrders.forEach((order) => {
          taskItems.push({
            id: `order-${order.id}`,
            type: 'approval',
            title: `Pending Order ${order.order_number}`,
            description: 'Awaiting confirmation',
            priority: 'high',
            path: `/${tenantSlug}/admin/orders/${order.id}`,
          });
        });
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      taskItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      logger.info('[TaskList] Tasks fetched', { count: taskItems.length });

      return taskItems.slice(0, 10);
    },
    enabled: isReady && !!tenantId,
    refetchInterval: 60000, // Refresh every minute
  });

  if (!isReady || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-emerald-600" />
          <CardTitle>To-Do List</CardTitle>
        </div>
        <CardDescription>Pending approvals and items requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        {!tasks || tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">All caught up!</p>
            <p className="text-xs text-gray-500 mt-1">No pending tasks</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(task.path)}
              >
                <div className="mt-0.5 p-2 bg-gray-50 rounded-lg">
                  {getTaskIcon(task.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">{task.title}</p>
                    <Badge className={getPriorityColor(task.priority)} variant="outline">
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">{task.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
