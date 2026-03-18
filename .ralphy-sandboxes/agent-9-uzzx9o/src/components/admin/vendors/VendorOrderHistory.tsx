import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Database } from '@/integrations/supabase/types';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Search,
  Plus,
  Loader2,
  DollarSign,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  CircleDashed,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { usePagination } from '@/hooks/usePagination';
import { formatSmartDate } from '@/lib/formatters';

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];

interface PurchaseOrderWithItems extends PurchaseOrder {
  purchase_order_items: PurchaseOrderItem[];
}

interface PurchaseOrderWithPayment extends PurchaseOrderWithItems {
  payment_status?: string | null;
  paid_amount?: number | null;
}

interface VendorOrderHistoryProps {
  vendorId: string;
  vendorName: string;
}

type POStatus = 'all' | 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';

export function VendorOrderHistory({ vendorId, vendorName }: VendorOrderHistoryProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus>('all');

  // Fetch purchase orders for this vendor
  const { data: purchaseOrders, isLoading, error } = useQuery({
    queryKey: queryKeys.vendors.orders(tenant?.id ?? '', vendorId),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          purchase_order_items (*)
        `)
        .eq('account_id', tenant.id)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch vendor purchase orders', error, { component: 'VendorOrderHistory' });
        throw error;
      }

      return (data ?? []) as PurchaseOrderWithItems[];
    },
    enabled: !!tenant?.id && !!vendorId,
  });

  // Filter purchase orders
  const filteredOrders = useMemo(() => {
    if (!purchaseOrders) return [];

    return purchaseOrders.filter((po) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || po.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedData,
    goToPage,
    previousPage: _prevPage,
    nextPage: _nextPage,
    changePageSize,
  } = usePagination(filteredOrders, {
    defaultPageSize: 10,
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!purchaseOrders) return { totalOrders: 0, totalSpentAllTime: 0, totalSpentThisMonth: 0 };

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalSpentAllTime = 0;
    let totalSpentThisMonth = 0;

    purchaseOrders.forEach((po) => {
      // Only count completed orders (received) for spent totals
      if (po.status === 'received' || po.status === 'confirmed') {
        totalSpentAllTime += po.total ?? 0;

        const poDate = po.created_at ? new Date(po.created_at) : null;
        if (poDate && poDate >= firstOfMonth) {
          totalSpentThisMonth += po.total ?? 0;
        }
      }
    });

    return {
      totalOrders: purchaseOrders.length,
      totalSpentAllTime,
      totalSpentThisMonth,
    };
  }, [purchaseOrders]);

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'draft':
        return 'outline';
      case 'sent':
        return 'secondary';
      case 'confirmed':
        return 'default';
      case 'received':
        return 'default';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeClass = (status: string | null) => {
    if (status === 'received') {
      return 'bg-green-500';
    }
    return '';
  };

  const getPaymentStatusBadge = (paymentStatus: string | null | undefined) => {
    switch (paymentStatus) {
      case 'paid':
        return (
          <Badge variant="default" className="bg-green-500 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Partial
          </Badge>
        );
      case 'unpaid':
      default:
        return (
          <Badge variant="outline" className="flex items-center gap-1 text-orange-600 border-orange-300">
            <CircleDashed className="h-3 w-3" />
            Unpaid
          </Badge>
        );
    }
  };

  const getItemsCount = (po: PurchaseOrderWithItems): number => {
    return po.purchase_order_items?.length ?? 0;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return formatSmartDate(dateString);
  };

  const handlePOClick = (poId: string) => {
    navigateToAdmin(`purchase-orders/${poId}`);
  };

  const handleCreatePO = () => {
    navigateToAdmin(`purchase-orders/new?vendor=${vendorId}`);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load purchase orders. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">All-time purchase orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent (All Time)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSpentAllTime)}</div>
            <p className="text-xs text-muted-foreground">Completed orders only</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spent This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSpentThisMonth)}</div>
            <p className="text-xs text-muted-foreground">Current month spending</p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Purchase Order History</CardTitle>
              <CardDescription>
                All purchase orders placed with {vendorName}
              </CardDescription>
            </div>
            <Button onClick={handleCreatePO}>
              <Plus className="h-4 w-4 mr-2" />
              New Purchase Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by PO number..."
                  aria-label="Search by PO number"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as POStatus)}>
              <SelectTrigger className="w-full md:w-[180px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <EnhancedEmptyState
              icon={FileText}
              title={searchTerm || statusFilter !== 'all' ? 'No Purchase Orders Found' : 'No Purchase Orders Yet'}
              description={
                searchTerm || statusFilter !== 'all'
                  ? 'No purchase orders match your filters.'
                  : `No purchase orders have been placed with ${vendorName} yet.`
              }
              primaryAction={
                !searchTerm && statusFilter === 'all'
                  ? {
                      label: 'Create Purchase Order',
                      onClick: handleCreatePO,
                      icon: Plus,
                    }
                  : undefined
              }
              secondaryAction={
                searchTerm || statusFilter !== 'all'
                  ? {
                      label: 'Clear Filters',
                      onClick: () => {
                        setSearchTerm('');
                        setStatusFilter('all');
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((po) => (
                      <TableRow
                        key={po.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handlePOClick(po.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{po.po_number}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(po.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(po.total)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(po.status)}
                            className={getStatusBadgeClass(po.status)}
                          >
                            {po.status || 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getPaymentStatusBadge((po as PurchaseOrderWithPayment).payment_status)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Package className="h-3 w-3" />
                            {getItemsCount(po)}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(po.expected_delivery_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <StandardPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    onPageSizeChange={changePageSize}
                    totalItems={filteredOrders.length}
                    pageSize={10}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
