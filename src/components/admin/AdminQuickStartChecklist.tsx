import { useQuery } from '@tanstack/react-query';
import { Check, Circle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  path: string;
}

export function AdminQuickStartChecklist() {
  const { tenantId, tenantSlug, isReady } = useTenantContext();
  const navigate = useNavigate();

  const { data: checklistStatus, isLoading } = useQuery({
    queryKey: queryKeys.onboarding.checklist(tenantId ?? ''),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      logger.info('[QuickStartChecklist] Checking setup status', { tenantId });

      // Check if profile is complete
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, business_name, address, phone')
        .eq('id', tenantId)
        .maybeSingle();

      const profileComplete = !!(
        tenant?.name &&
        tenant?.business_name &&
        tenant?.address &&
        tenant?.phone
      );

      // Check if products added
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const productAdded = (productsCount ?? 0) > 0;

      // Check if delivery zones set
      const { count: zonesCount } = await supabase
        .from('delivery_zones')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const zoneSet = (zonesCount ?? 0) > 0;

      // Check if first order received
      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const firstOrder = (ordersCount ?? 0) > 0;

      const checklist: ChecklistItem[] = [
        {
          id: 'profile',
          label: 'Complete Business Profile',
          description: 'Add your business details and contact information',
          completed: profileComplete,
          path: `/${tenantSlug}/admin/settings/general`,
        },
        {
          id: 'product',
          label: 'Add Your First Product',
          description: 'Create at least one product in your catalog',
          completed: productAdded,
          path: `/${tenantSlug}/admin/products/new`,
        },
        {
          id: 'zone',
          label: 'Set Delivery Zones',
          description: 'Define areas where you offer delivery',
          completed: zoneSet,
          path: `/${tenantSlug}/admin/settings/delivery-zones`,
        },
        {
          id: 'order',
          label: 'Receive First Order',
          description: 'Start processing customer orders',
          completed: firstOrder,
          path: `/${tenantSlug}/admin/orders`,
        },
      ];

      const completedCount = checklist.filter((item) => item.completed).length;
      const progressPercent = (completedCount / checklist.length) * 100;

      logger.info('[QuickStartChecklist] Status checked', { completedCount, total: checklist.length });

      return {
        checklist,
        completedCount,
        totalCount: checklist.length,
        progressPercent,
      };
    },
    enabled: isReady && !!tenantId,
  });

  if (!isReady || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!checklistStatus) {
    return null;
  }

  // Don't show if everything is complete
  if (checklistStatus.progressPercent === 100) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Start Checklist</CardTitle>
        <CardDescription>
          Complete these steps to get your dispensary up and running
        </CardDescription>
        <div className="pt-2">
          <Progress value={checklistStatus.progressPercent} className="h-2" />
          <p className="text-sm text-gray-600 mt-2">
            {checklistStatus.completedCount} of {checklistStatus.totalCount} completed
            {' '}
            ({Math.round(checklistStatus.progressPercent)}%)
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {checklistStatus.checklist.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              item.completed ? 'bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="mt-0.5">
              {item.completed ? (
                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              ) : (
                <Circle className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-sm ${item.completed ? 'text-emerald-900' : 'text-gray-900'}`}>
                {item.label}
              </p>
              <p className="text-xs text-gray-600">{item.description}</p>
            </div>
            {!item.completed && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(item.path)}
                className="gap-1"
              >
                Start
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
