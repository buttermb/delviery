import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import Building2 from "lucide-react/dist/esm/icons/building-2";
import Package from "lucide-react/dist/esm/icons/package";
import Clock from "lucide-react/dist/esm/icons/clock";
import Truck from "lucide-react/dist/esm/icons/truck";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Eye from "lucide-react/dist/esm/icons/eye";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Phone from "lucide-react/dist/esm/icons/phone";
import Mail from "lucide-react/dist/esm/icons/mail";
import Plus from "lucide-react/dist/esm/icons/plus";
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { LastUpdated } from '@/components/shared/LastUpdated';
import { DateRangePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import CopyButton from '@/components/CopyButton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface B2BOrder {
  id: string;
  order_number: string;
  client_id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  delivery_address: string;
  delivery_notes?: string | null;
  created_at: string;
  runner_id?: string | null;
  client?: {
    id: string;
    business_name: string;
    contact_name: string;
    phone: string;
    email: string;
    client_type: string;
    address: string;
  } | null;
  items?: Array<{
    id: string;
    product_name: string;
    quantity_lbs: number;
    unit_price: number;
  }>;
}

interface B2BOrdersTabProps {
  onOrderSelect?: (order: B2BOrder) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: CheckCircle2 },
  in_transit: { label: 'In Transit', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  partial: { label: 'Partial', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  paid: { label: 'Paid', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

export const B2BOrdersTab = ({ onOrderSelect }: B2BOrdersTabProps) => {
  const { tenant } = useTenantAdminAuth();
  const navigate = useTenantNavigate();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Fetch B2B orders (wholesale orders with business clients)
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.wholesaleOrders.list({
      tenantId: tenant?.id,
      statusFilter,
      paymentFilter,
      type: 'b2b'
    }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('wholesale_orders')
        .select(`
          id,
          order_number,
          client_id,
          total_amount,
          status,
          payment_status,
          delivery_address,
          delivery_notes,
          created_at,
          runner_id,
          client:wholesale_clients(
            id,
            business_name,
            contact_name,
            phone,
            email,
            client_type,
            address
          ),
          items:wholesale_order_items(
            id,
            product_name,
            quantity,
            unit_price
          )
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch B2B orders', error, { component: 'B2BOrdersTab' });
        throw error;
      }

      // Transform the data to match our interface (cast to any to bypass type issues)
      return (data || []).map((order: any) => ({
        ...order,
        client: Array.isArray(order.client) ? order.client[0] : order.client,
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          product_name: item.product_name,
          quantity_lbs: item.quantity || 0,
          unit_price: item.unit_price,
        })),
      })) as B2BOrder[];
    },
    enabled: !!tenant?.id,
    staleTime: 15_000,
    gcTime: 120_000,
  });

  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

    // Payment status filter
    if (paymentFilter !== 'all') {
      result = result.filter(order => order.payment_status === paymentFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.order_number?.toLowerCase().includes(query) ||
        order.client?.business_name?.toLowerCase().includes(query) ||
        order.client?.contact_name?.toLowerCase().includes(query) ||
        order.client?.email?.toLowerCase().includes(query) ||
        order.client?.phone?.includes(query) ||
        order.total_amount?.toString().includes(query)
      );
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      result = result.filter(order => {
        if (!order.created_at) return false;
        const orderDate = new Date(order.created_at);

        if (dateRange.from && dateRange.to) {
          return isWithinInterval(orderDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          });
        }
        if (dateRange.from) {
          return orderDate >= startOfDay(dateRange.from);
        }
        if (dateRange.to) {
          return orderDate <= endOfDay(dateRange.to);
        }
        return true;
      });
    }

    return result;
  }, [orders, searchQuery, statusFilter, paymentFilter, dateRange]);

  // Stats
  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    inTransit: orders.filter(o => o.status === 'in_transit').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    unpaid: orders.filter(o => o.payment_status === 'unpaid').length,
    totalRevenue: orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
  }), [orders]);

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectedOrders(checked ? filteredOrders.map(o => o.id) : []);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders(prev =>
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  };

  const handleRowClick = (order: B2BOrder) => {
    if (onOrderSelect) {
      onOrderSelect(order);
    } else {
      navigate(`wholesale-orders/${order.id}`);
    }
  };

  const handleRefresh = async () => {
    await refetch();
    toast.success('Orders refreshed');
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || paymentFilter !== 'all' || dateRange.from || dateRange.to;

  // Table columns
  const columns: ResponsiveColumn<B2BOrder>[] = [
    {
      header: (
        <Checkbox
          checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
          aria-label="Select all orders"
        />
      ) as unknown as string,
      className: 'w-[40px]',
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedOrders.includes(order.id)}
            onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
            aria-label="Select order"
          />
        </div>
      ),
    },
    {
      header: 'Order #',
      cell: (order) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-primary">{order.order_number}</span>
          <CopyButton text={order.order_number} size="sm" showLabel={false} />
        </div>
      ),
    },
    {
      header: 'Business Customer',
      cell: (order) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{order.client?.business_name || 'Unknown Business'}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{order.client?.contact_name}</span>
            {order.client?.client_type && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {order.client.client_type}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {order.client?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {order.client.phone}
              </span>
            )}
            {order.client?.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {order.client.email}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Items',
      cell: (order) => (
        <span className="text-muted-foreground">
          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
        </span>
      ),
      className: 'w-[80px]',
    },
    {
      header: 'Total',
      cell: (order) => (
        <span className="font-mono font-semibold">
          {formatCurrency(order.total_amount)}
        </span>
      ),
      className: 'text-right',
    },
    {
      header: 'Status',
      cell: (order) => {
        const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        const StatusIcon = config.icon;
        return (
          <Badge variant="outline" className={`gap-1 ${config.color}`}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      header: 'Payment',
      cell: (order) => {
        const config = PAYMENT_STATUS_CONFIG[order.payment_status] || PAYMENT_STATUS_CONFIG.unpaid;
        return (
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      header: 'Date',
      cell: (order) => (
        <span className="text-muted-foreground text-sm">
          {formatSmartDate(order.created_at)}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (order) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-11 w-11 p-0"
            onClick={() => navigate(`wholesale-orders/${order.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'w-[60px]',
    },
  ];

  // Mobile card renderer
  const mobileRenderer = (order: B2BOrder) => {
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const paymentConfig = PAYMENT_STATUS_CONFIG[order.payment_status] || PAYMENT_STATUS_CONFIG.unpaid;

    return (
      <div className="flex flex-col gap-3 p-1">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-primary">#{order.order_number}</span>
              <CopyButton text={order.order_number} size="sm" showLabel={false} />
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.client?.business_name || 'Unknown Business'}</span>
            </div>
            <span className="text-xs text-muted-foreground">{order.client?.contact_name}</span>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className={`gap-1 ${statusConfig.color}`}>
              {statusConfig.label}
            </Badge>
            <Badge variant="outline" className={paymentConfig.color}>
              {paymentConfig.label}
            </Badge>
          </div>
        </div>
        <div className="flex justify-between items-center border-t pt-2">
          <span className="text-xs text-muted-foreground">
            {formatSmartDate(order.created_at)} • {order.items?.length || 0} items
          </span>
          <span className="font-mono font-bold">{formatCurrency(order.total_amount)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground whitespace-nowrap truncate">Total Orders</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground whitespace-nowrap truncate">Pending</p>
              <p className="text-lg font-bold">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Truck className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground whitespace-nowrap truncate">In Transit</p>
              <p className="text-lg font-bold">{stats.inTransit}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground whitespace-nowrap truncate">Delivered</p>
              <p className="text-lg font-bold">{stats.delivered}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground whitespace-nowrap truncate">Unpaid</p>
              <p className="text-lg font-bold">{stats.unpaid}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground whitespace-nowrap truncate">Total Revenue</p>
              <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by order #, business name, contact..."
                defaultValue={searchQuery}
                onSearch={setSearchQuery}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePickerWithPresets
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              placeholder="Date range"
              className="w-full sm:w-[200px]"
            />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <LastUpdated date={new Date()} onRefresh={handleRefresh} isLoading={isLoading} />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="overflow-hidden">
        <ResponsiveTable<B2BOrder>
          columns={columns}
          data={filteredOrders}
          isLoading={isLoading}
          mobileRenderer={mobileRenderer}
          keyExtractor={(order) => order.id}
          onRowClick={handleRowClick}
          emptyState={{
            icon: Building2,
            title: 'No B2B Orders Found',
            description: hasActiveFilters
              ? 'No orders match your current filters. Try adjusting your search criteria.'
              : 'No business customer orders yet. Create your first B2B order to get started.',
            primaryAction: !hasActiveFilters ? {
              label: 'Create B2B Order',
              onClick: () => navigate('wholesale-orders/new'),
              icon: Plus,
            } : {
              label: 'Clear Filters',
              onClick: handleClearFilters,
            },
          }}
        />
      </Card>

      {/* Selected orders count */}
      {selectedOrders.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg z-50">
          {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};
