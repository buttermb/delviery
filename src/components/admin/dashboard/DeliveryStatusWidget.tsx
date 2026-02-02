/**
 * Delivery Status Widget
 * Displays active, in-transit, and completed delivery counts
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Truck from "lucide-react/dist/esm/icons/truck";
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Package from "lucide-react/dist/esm/icons/package";
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DeliveryStats {
  active: number;
  inTransit: number;
  completed: number;
  total: number;
}

interface StatusCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  delay?: number;
}

function StatusCard({ title, count, icon, colorClass, delay = 0 }: StatusCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
    >
      <div className={cn('p-2 rounded-lg', colorClass)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        <motion.p
          key={count}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-2xl font-bold"
        >
          {count}
        </motion.p>
      </div>
    </motion.div>
  );
}

export function DeliveryStatusWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();

  const getFullPath = (path: string) => {
    if (!tenantSlug) return path;
    if (path.startsWith('/admin')) {
      return `/${tenantSlug}${path}`;
    }
    return path;
  };

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.deliveries.list({ tenantId: tenant?.id, widget: 'status' }),
    queryFn: async (): Promise<DeliveryStats> => {
      if (!tenant?.id) {
        return { active: 0, inTransit: 0, completed: 0, total: 0 };
      }

      // Fetch order delivery statuses
      const { data, error } = await supabase
        .from('orders')
        .select('status')
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'confirmed', 'out_for_delivery', 'delivered']);

      if (error) throw error;

      const orders = data || [];

      // Calculate counts based on status
      const active = orders.filter(
        (o) => o.status === 'pending' || o.status === 'confirmed'
      ).length;
      const inTransit = orders.filter(
        (o) => o.status === 'out_for_delivery'
      ).length;
      const completed = orders.filter(
        (o) => o.status === 'delivered'
      ).length;

      return {
        active,
        inTransit,
        completed,
        total: orders.length,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds stale time
    refetchInterval: 60000, // Refetch every minute
  });

  const deliveryStats = stats || { active: 0, inTransit: 0, completed: 0, total: 0 };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Delivery Status
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(getFullPath('/admin/delivery-management'))}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : deliveryStats.total > 0 ? (
          <>
            <StatusCard
              title="Active"
              count={deliveryStats.active}
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              colorClass="bg-amber-100 dark:bg-amber-950/50"
              delay={0}
            />
            <StatusCard
              title="In Transit"
              count={deliveryStats.inTransit}
              icon={<Truck className="h-5 w-5 text-blue-600" />}
              colorClass="bg-blue-100 dark:bg-blue-950/50"
              delay={0.1}
            />
            <StatusCard
              title="Completed"
              count={deliveryStats.completed}
              icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
              colorClass="bg-green-100 dark:bg-green-950/50"
              delay={0.2}
            />
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No deliveries to display</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
