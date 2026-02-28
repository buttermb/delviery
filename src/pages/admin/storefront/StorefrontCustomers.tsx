/**
 * Storefront Customers Page
 * View and manage store customers
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTablePreferences } from '@/hooks/useTablePreferences';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Users,
  ShoppingCart,
  DollarSign,
  Phone,
  Calendar,
  TrendingUp,
  RefreshCw,
  Link2,
  CheckCircle2
} from 'lucide-react';
import { ExportButton } from '@/components/ui/ExportButton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { useMarketplaceCustomerSync } from '@/hooks/useMarketplaceCustomerSync';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { queryKeys } from '@/lib/queryKeys';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Customer {
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_orders: number;
  total_spent: number;
  first_order: string;
  last_order: string;
}

export default function StorefrontCustomers() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const tenantId = tenant?.id;

  // Table preferences persistence
  const { preferences, savePreferences } = useTablePreferences('storefront-customers', {
    sortBy: 'total_spent'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>(preferences.sortBy ?? 'total_spent');

  // Marketplace customer sync hook
  const { sync: syncCustomers, isSyncing, syncResult } = useMarketplaceCustomerSync();

  // Persist sort preference
  useEffect(() => {
    savePreferences({ sortBy });
  }, [sortBy, savePreferences]);

  // Fetch store
  const { data: store } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch customers aggregated from orders
  const { data: customers = [], isLoading } = useQuery({
    queryKey: queryKeys.storefrontCustomers.byStore(store?.id),
    queryFn: async () => {
      if (!store?.id) return [];

      // Aggregate customer data from orders
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('customer_email, customer_name, customer_phone, total_amount, created_at')
        .eq('store_id', store.id)
        .not('customer_email', 'is', null);

      if (error) throw error;
      const orders = data as unknown as Array<{
        customer_email: string;
        customer_name: string | null;
        customer_phone: string | null;
        total_amount: number;
        created_at: string;
      }>;

      // Group by email and aggregate
      const customerMap = new Map<string, Customer>();

      orders?.forEach((order) => {
        const email = order.customer_email;
        if (!email) return;

        const existing = customerMap.get(email);
        if (existing) {
          existing.total_orders += 1;
          existing.total_spent += order.total_amount ?? 0;
          if (new Date(order.created_at) > new Date(existing.last_order)) {
            existing.last_order = order.created_at;
            existing.customer_name = order.customer_name ?? existing.customer_name;
            existing.customer_phone = order.customer_phone ?? existing.customer_phone;
          }
          if (new Date(order.created_at) < new Date(existing.first_order)) {
            existing.first_order = order.created_at;
          }
        } else {
          customerMap.set(email, {
            customer_email: email,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            total_orders: 1,
            total_spent: order.total_amount ?? 0,
            first_order: order.created_at,
            last_order: order.created_at,
          });
        }
      });

      return Array.from(customerMap.values());
    },
    enabled: !!store?.id,
  });

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    let result = [...customers];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.customer_email?.toLowerCase().includes(query) ||
          c.customer_name?.toLowerCase().includes(query) ||
          c.customer_phone?.includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'total_spent':
          return b.total_spent - a.total_spent;
        case 'total_orders':
          return b.total_orders - a.total_orders;
        case 'recent':
          return new Date(b.last_order).getTime() - new Date(a.last_order).getTime();
        case 'name':
          return (a.customer_name ?? '').localeCompare(b.customer_name ?? '');
        default:
          return 0;
      }
    });

    return result;
  }, [customers, searchQuery, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0);
    const avgOrderValue = totalRevenue / Math.max(customers.reduce((sum, c) => sum + c.total_orders, 0), 1);
    const repeatCustomers = customers.filter((c) => c.total_orders > 1).length;

    return { totalCustomers, totalRevenue, avgOrderValue, repeatCustomers };
  }, [customers]);

  // Export columns definition
  const exportColumns = [
    { key: 'customer_email', label: 'Email' },
    { key: 'customer_name', label: 'Name' },
    { key: 'customer_phone', label: 'Phone' },
    { key: 'total_orders', label: 'Total Orders' },
    { key: 'total_spent', label: 'Total Spent' },
    { key: 'first_order', label: 'First Order' },
    { key: 'last_order', label: 'Last Order' },
  ];

  if (!store) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => window.location.href = `/${tenantSlug}/admin/storefront`}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customer Directory</h1>
          <p className="text-muted-foreground">
            {stats.totalCustomers} customers · {formatCurrency(stats.totalRevenue)} total revenue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => store?.id && syncCustomers(store.id)}
                  disabled={isSyncing || !store?.id}
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : syncResult?.synced_count ? (
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Sync to CRM
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync storefront customers to your Customer Hub for unified CRM management</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ExportButton
            data={filteredCustomers as any}
            filename="storefront-customers"
            columns={exportColumns}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{stats.totalCustomers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgOrderValue)}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Repeat Customers</p>
                <p className="text-2xl font-bold">
                  {stats.repeatCustomers}
                  <span className="text-sm text-muted-foreground ml-1">
                    ({stats.totalCustomers > 0 ? Math.round((stats.repeatCustomers / stats.totalCustomers) * 100) : 0}%)
                  </span>
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                aria-label="Search by email, name, or phone"
                placeholder="Search by email, name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_spent">Highest Spent</SelectItem>
                <SelectItem value="total_orders">Most Orders</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-semibold">No customers found</p>
              <p className="text-sm">
                {searchQuery ? 'Try a different search' : 'Customers will appear here after their first order'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead>Last Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.customer_email}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold">
                            {(customer.customer_name || customer.customer_email)?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {customer.customer_name ?? 'Guest'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {customer.customer_email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.customer_phone ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {customer.customer_phone}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{customer.total_orders}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(customer.total_spent)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatSmartDate(customer.last_order)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
