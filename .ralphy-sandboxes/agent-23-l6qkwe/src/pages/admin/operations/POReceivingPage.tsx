/**
 * PO Receiving Page
 * Shows purchase orders that are approved and ready for receiving.
 * Integrates with the receiving workflow for inventory management.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/formatters';
import {
  Package,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  Calendar,
  DollarSign,
  ArrowRight,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { POReceiveDialog } from '@/components/admin/purchase-orders/POReceiveDialog';
import { queryKeys } from '@/lib/queryKeys';
import type { Database } from '@/integrations/supabase/types';

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];
type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row'];

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-500',
  submitted: 'bg-blue-500',
  partially_received: 'bg-yellow-500',
};

export default function POReceivingPage() {
  const { tenant } = useTenantAdminAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('approved');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);

  // Fetch POs that are approved or submitted (ready for receiving)
  const { data: purchaseOrders, isLoading: posLoading } = useQuery({
    queryKey: queryKeys.purchaseOrders.list({ status: statusFilter, tenantId: tenant?.id, receiving: true }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Break type inference for complex query (same pattern as PurchaseOrdersPage)
      let baseQuery = supabase
        .from('purchase_orders')
        .select('id, po_number, vendor_id, status, total, expected_delivery_date, notes, tenant_id, created_at, updated_at')
        .eq('tenant_id', tenant.id)
        .order('expected_delivery_date', { ascending: true });

      // Filter by status - approved POs are ready for receiving
      if (statusFilter === 'all') {
        baseQuery = baseQuery.in('status', ['approved', 'submitted']);
      } else {
        baseQuery = baseQuery.eq('status', statusFilter);
      }

      const { data, error } = await baseQuery;

      if (error) {
        logger.error('Failed to fetch purchase orders for receiving', error, { component: 'POReceivingPage' });
        return [];
      }

      return (data ?? []) as PurchaseOrder[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch items for selected PO
  const { data: selectedPOItems } = useQuery({
    queryKey: queryKeys.purchaseOrders.items(selectedPO?.id ?? ''),
    queryFn: async () => {
      if (!selectedPO?.id) return [];

      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('id, purchase_order_id, product_id, product_name, quantity_ordered, quantity_received, unit_price, total_price, created_at')
        .eq('purchase_order_id', selectedPO.id)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to fetch PO items', error, { component: 'POReceivingPage' });
        return [];
      }

      return (data ?? []) as PurchaseOrderItem[];
    },
    enabled: !!selectedPO?.id && receiveDialogOpen,
  });

  // Fetch vendor info for display
  const { data: vendors } = useQuery({
    queryKey: queryKeys.vendors.byTenant(tenant!.id),
    queryFn: async () => {
      if (!tenant?.id) return {};

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id, name')
        .eq('tenant_id', tenant.id);

      const { data: supplierData } = await supabase
        .from('wholesale_suppliers')
        .select('id, supplier_name')
        .eq('tenant_id', tenant.id);

      const vendorMap: Record<string, string> = {};
      vendorData?.forEach(v => { vendorMap[v.id] = v.name; });
      supplierData?.forEach(s => { vendorMap[s.id] = s.supplier_name; });

      return vendorMap;
    },
    enabled: !!tenant?.id,
  });

  const filteredPOs = purchaseOrders?.filter((po) => {
    const vendorName = vendors?.[po.vendor_id] ?? '';
    const matchesSearch =
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) ?? [];

  const handleReceive = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setReceiveDialogOpen(true);
  };

  // Calculate stats
  const approvedCount = purchaseOrders?.filter(po => po.status === 'approved').length ?? 0;
  const submittedCount = purchaseOrders?.filter(po => po.status === 'submitted').length ?? 0;
  const totalValue = purchaseOrders?.reduce((sum, po) => sum + Number(po.total ?? 0), 0) ?? 0;
  const dueTodayCount = purchaseOrders?.filter(po => {
    if (!po.expected_delivery_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return po.expected_delivery_date === today;
  }).length ?? 0;

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">
            PO Receiving
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Receive and inspect purchase orders from suppliers
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xl sm:text-2xl font-bold">{approvedCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Ready to Receive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xl sm:text-2xl font-bold">{submittedCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span className="text-xl sm:text-2xl font-bold">{dueTodayCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Expected Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xl sm:text-2xl font-bold">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                aria-label="Search by PO number, vendor, or notes"
                placeholder="Search by PO number, vendor, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[200px] min-h-[44px] touch-manipulation">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pending</SelectItem>
              <SelectItem value="approved">Ready to Receive</SelectItem>
              <SelectItem value="submitted">Awaiting Approval</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* POs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Purchase Orders for Receiving ({filteredPOs.length})
          </CardTitle>
          <CardDescription>
            Select a purchase order to receive items and update inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          {posLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No purchase orders awaiting receipt</p>
              <p className="text-sm text-muted-foreground">
                Approved POs will appear here for receiving
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPOs.map((po) => {
                    const isOverdue = po.expected_delivery_date &&
                      new Date(po.expected_delivery_date) < new Date() &&
                      po.status === 'approved';
                    const isDueToday = po.expected_delivery_date === new Date().toISOString().split('T')[0];

                    return (
                      <TableRow
                        key={po.id}
                        className={`cursor-pointer hover:bg-accent ${isOverdue ? 'bg-red-500/5' : isDueToday ? 'bg-orange-500/5' : ''}`}
                        onClick={() => handleReceive(po)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReceive(po); } }}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {po.po_number}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${STATUS_COLORS[po.status ?? 'approved']} text-white border-0`}
                          >
                            {po.status === 'approved' ? 'Ready' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{vendors?.[po.vendor_id] ?? 'Unknown Vendor'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {po.expected_delivery_date ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className={isOverdue ? 'text-red-500 font-medium' : isDueToday ? 'text-orange-500 font-medium' : ''}>
                                {formatSmartDate(po.expected_delivery_date)}
                              </span>
                              {isOverdue && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {Number(po.total ?? 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div onClick={(e) => e.stopPropagation()}>
                            {po.status === 'approved' ? (
                              <Button
                                size="sm"
                                onClick={() => handleReceive(po)}
                                className="min-h-[36px] touch-manipulation bg-emerald-500 hover:bg-emerald-600"
                              >
                                <Truck className="h-4 w-4 mr-2" />
                                Receive
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReceive(po)}
                                className="min-h-[36px] touch-manipulation"
                              >
                                <Clock className="h-4 w-4 mr-2" />
                                View
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receive Dialog */}
      {selectedPO && (
        <POReceiveDialog
          open={receiveDialogOpen}
          onOpenChange={(open) => {
            setReceiveDialogOpen(open);
            if (!open) setSelectedPO(null);
          }}
          purchaseOrder={selectedPO}
          items={selectedPOItems ?? []}
          onSuccess={() => {
            setReceiveDialogOpen(false);
            setSelectedPO(null);
          }}
        />
      )}
    </div>
  );
}
