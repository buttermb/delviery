/**
 * Recent Customers Widget
 * Displays new customer signups from the past week
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Mail from "lucide-react/dist/esm/icons/mail";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { subDays, formatDistanceToNow } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { queryKeys } from '@/lib/queryKeys';

interface RecentCustomer {
  id: string;
  email: string;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
}

export function RecentCustomersWidget() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const getFullPath = (path: string) => {
    if (!tenantSlug) return path;
    if (path.startsWith('/admin')) {
      return `/${tenantSlug}${path}`;
    }
    return path;
  };

  const { data: customers, isLoading } = useQuery({
    queryKey: [...queryKeys.customers.all, 'recent-week', tenant?.id],
    queryFn: async (): Promise<RecentCustomer[]> => {
      if (!tenant?.id) return [];

      const oneWeekAgo = subDays(new Date(), 7);

      const { data, error } = await (supabase as any)
        .from('customers')
        .select('id, email, created_at, first_name, last_name')
        .eq('tenant_id', tenant.id)
        .gte('created_at', oneWeekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      return (data || []) as RecentCustomer[];
    },
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds
  });

  const getCustomerName = (customer: RecentCustomer): string => {
    if (customer.first_name || customer.last_name) {
      return [customer.first_name, customer.last_name].filter(Boolean).join(' ');
    }
    return customer.email.split('@')[0];
  };

  const getInitials = (customer: RecentCustomer): string => {
    if (customer.first_name && customer.last_name) {
      return `${customer.first_name[0]}${customer.last_name[0]}`.toUpperCase();
    }
    if (customer.first_name) {
      return customer.first_name.slice(0, 2).toUpperCase();
    }
    return customer.email.slice(0, 2).toUpperCase();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          New Signups
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(getFullPath('/admin/crm/clients'))}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))
        ) : customers && customers.length > 0 ? (
          customers.map((customer) => (
            <div
              key={customer.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(getFullPath(`/admin/crm/clients/${customer.id}`))}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                {getInitials(customer)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {getCustomerName(customer)}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDistanceToNow(new Date(customer.created_at), { addSuffix: true })}
              </Badge>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No new signups this week</p>
          </div>
        )}
      </div>

      {customers && customers.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <div className="text-sm text-muted-foreground text-center">
            {customers.length} new {customers.length === 1 ? 'customer' : 'customers'} this week
          </div>
        </div>
      )}
    </Card>
  );
}
