import { logger } from '@/lib/logger';
/**
 * Unified Orders Page
 * Customers can view all orders (retail + wholesale) in one place
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Package,
  Search,
  Filter,
  Eye,
  ShoppingBag,
  Building2,
  Clock,
  CheckCircle,
  Truck
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModeBanner } from '@/components/customer/ModeSwitcher';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { queryKeys } from '@/lib/queryKeys';

type CustomerMode = 'retail' | 'wholesale';
type OrderType = 'all' | 'retail' | 'wholesale';

interface UnifiedOrder {
  id: string;
  created_at: string;
  order_type: 'retail' | 'wholesale';
  display_number: string | null;
  display_total: number | null;
  display_status: string | null;
  seller_name?: string;
  tracking_number?: string | null;
}

export default function UnifiedOrdersPage() {
  const { slug } = useParams<{ slug: string }>();
  const { customer, tenant } = useCustomerAuth();
  const navigate = useNavigate();
  const tenantId = tenant?.id;
  const customerId = customer?.customer_id || customer?.id;
  const customerEmail = customer?.email;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<OrderType>('all');
  const [mode, setMode] = useState<CustomerMode>('retail');

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
      }
    } catch {
      // Ignore storage errors
    }
  }, [setMode]);

  // Fetch retail orders
  const { data: retailOrders = [], isLoading: retailLoading } = useQuery({
    queryKey: queryKeys.customerRetailOrders.byCustomer(tenantId, customerId, statusFilter),
    queryFn: async () => {
      if (!tenantId || !customerId) return [];

      let query = supabase
        .from('orders')
        .select('id, created_at, order_number, total_amount, status')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch retail orders', error, { component: 'UnifiedOrdersPage' });
        throw error;
      }

      return (data ?? []).map((order): UnifiedOrder => ({
        id: order.id,
        created_at: order.created_at,
        order_type: 'retail' as const,
        display_number: order.order_number,
        display_total: order.total_amount,
        display_status: order.status,
        tracking_number: null,
      }));
    },
    enabled: !!tenantId && !!customerId && (orderTypeFilter === 'all' || orderTypeFilter === 'retail'),
  });

  // Fetch wholesale orders
  const { data: wholesaleOrders = [], isLoading: wholesaleLoading } = useQuery({
    queryKey: queryKeys.customerWholesaleOrders.byTenant(tenantId, statusFilter),
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('marketplace_orders')
        .select(`
          *,
          marketplace_profiles!seller_profile_id (
            id,
            business_name
          )
        `)
        .eq('buyer_tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch wholesale orders', error, { component: 'UnifiedOrdersPage' });
        throw error;
      }

      return (data ?? []).map((order): UnifiedOrder => ({
        id: order.id,
        created_at: order.created_at,
        order_type: 'wholesale' as const,
        display_number: order.order_number,
        display_total: order.total_amount,
        display_status: order.status,
        seller_name: order.marketplace_profiles?.business_name || 'Unknown Seller',
        tracking_number: order.tracking_number,
      }));
    },
    enabled: !!tenantId && (orderTypeFilter === 'all' || orderTypeFilter === 'wholesale'),
  });

  // Fetch storefront orders (placed via checkout, stored in marketplace_orders by customer_email)
  const { data: storefrontOrders = [], isLoading: storefrontLoading } = useQuery({
    queryKey: queryKeys.customerStorefrontOrders.byEmail(tenantId, customerEmail, statusFilter),
    queryFn: async () => {
      if (!tenantId || !customerEmail) return [];

      let query = supabase
        .from('marketplace_orders')
        .select('id, created_at, order_number, total_amount, status, tracking_number')
        .eq('seller_tenant_id', tenantId)
        .eq('customer_email', customerEmail.toLowerCase())
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch storefront orders', error, { component: 'UnifiedOrdersPage' });
        throw error;
      }

      return (data ?? []).map((order): UnifiedOrder => ({
        id: order.id,
        created_at: order.created_at,
        order_type: 'retail' as const,
        display_number: order.order_number,
        display_total: order.total_amount,
        display_status: order.status,
        tracking_number: order.tracking_number,
      }));
    },
    enabled: !!tenantId && !!customerEmail && (orderTypeFilter === 'all' || orderTypeFilter === 'retail'),
  });

  // Combine orders (deduplicate by ID since storefront and wholesale both query marketplace_orders)
  const seenIds = new Set<string>();
  const allOrders = [...retailOrders, ...storefrontOrders, ...wholesaleOrders]
    .filter((order) => {
      if (seenIds.has(order.id)) return false;
      seenIds.add(order.id);
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at as string).getTime();
      const dateB = new Date(b.created_at as string).getTime();
      return dateB - dateA;
    });

  // Filter by search query
  const isLoading = retailLoading || wholesaleLoading || storefrontLoading;

  const filteredOrders = allOrders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.display_number?.toLowerCase().includes(query) ||
      order.seller_name?.toLowerCase().includes(query) ||
      order.tracking_number?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Package className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        );
      case 'shipped':
        return (
          <Badge className="bg-info/20 text-info border-info/30">
            <Truck className="h-3 w-3 mr-1" />
            Shipped
          </Badge>
        );
      case 'delivered':
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Delivered
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-16 lg:pb-0">
      {/* Mode Banner */}
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <ModeBanner currentMode={mode} onModeChange={setMode} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            All Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and track all your orders (retail and wholesale)
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order number, seller, tracking..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    aria-label="Search orders"
                  />
                </div>
              </div>
              <Select value={orderTypeFilter} onValueChange={(value) => setOrderTypeFilter(value as OrderType)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Order Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="retail">Retail Only</SelectItem>
                  <SelectItem value="wholesale">Wholesale Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <Tabs value={orderTypeFilter} onValueChange={(value) => setOrderTypeFilter(value as OrderType)}>
              <TabsList>
                <TabsTrigger value="all">All Orders ({filteredOrders.length})</TabsTrigger>
                <TabsTrigger value="retail">Retail ({retailOrders.length + storefrontOrders.length})</TabsTrigger>
                <TabsTrigger value="wholesale">Wholesale ({wholesaleOrders.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-4">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery ? 'Try adjusting your search or clear filters' : 'You haven\'t placed any orders yet. Browse a menu to get started!'}
                </p>
                {searchQuery && (
                  <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setOrderTypeFilter('all'); }}>
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={`${order.order_type}-${order.id}`}>
                        <TableCell className="font-medium">{order.display_number}</TableCell>
                        <TableCell>
                          {order.order_type === 'retail' ? (
                            <Badge variant="outline" className="border-primary/30 text-primary">
                              <ShoppingBag className="h-3 w-3 mr-1" />
                              Retail
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-info/30 text-info">
                              <Building2 className="h-3 w-3 mr-1" />
                              Wholesale
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.order_type === 'wholesale' ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{order.seller_name || 'Unknown'}</span>
                            </div>
                          ) : (
                            <span>{tenant?.business_name || 'Business'}</span>
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(Number(order.display_total) || 0)}</TableCell>
                        <TableCell>{getStatusBadge(order.display_status || 'pending')}</TableCell>
                        <TableCell>{formatSmartDate(order.created_at as string)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (order.order_type === 'retail') {
                                navigate(`/${slug}/shop/orders/${order.id}`);
                              } else {
                                navigate(`/${slug}/shop/wholesale/orders/${order.id}`);
                              }
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

