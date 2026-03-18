import { logger } from '@/lib/logger';
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import {
  Search,
  Plus,
  FileText,
  Calendar,
  DollarSign,
  Edit,
  Trash2,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Send,
  Package,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POCreateForm } from "@/components/admin/purchase-orders/POCreateForm";
import { PODetail } from "@/components/admin/purchase-orders/PODetail";
import { queryKeys } from "@/lib/queryKeys";
import { formatSmartDate } from '@/lib/formatters';
import type { Database } from "@/integrations/supabase/types";

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];

// PO statuses as per task requirements: draft, sent, confirmed, received, cancelled
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500 dark:bg-gray-600",
  sent: "bg-blue-500",
  confirmed: "bg-green-500",
  received: "bg-emerald-500",
  cancelled: "bg-red-500",
  // Legacy status mappings for backwards compatibility
  submitted: "bg-blue-500",
  approved: "bg-green-500",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: FileText,
  sent: Send,
  confirmed: CheckCircle2,
  received: Package,
  cancelled: XCircle,
  // Legacy status mappings for backwards compatibility
  submitted: Clock,
  approved: CheckCircle2,
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  received: "Received",
  cancelled: "Cancelled",
  // Legacy mappings
  submitted: "Sent",
  approved: "Confirmed",
};

export default function PurchaseOrders() {
  const { tenant } = useTenantAdminAuth();
  const [, setSearchParams] = useSearchParams();
  const { deletePurchaseOrder, updatePurchaseOrderStatus } = usePurchaseOrders();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

  const { data: purchaseOrders, isLoading, error } = useQuery({
    queryKey: queryKeys.purchaseOrders.list({ status: statusFilter, tenantId: tenant?.id }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from("purchase_orders")
        .select("id, po_number, vendor_id, status, total, notes, expected_delivery_date, created_at, tenant_id")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        logger.error('Failed to fetch purchase orders', queryError, { component: 'PurchaseOrders' });
        throw queryError;
      }

      return (data ?? []) as PurchaseOrder[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch vendors for display
  const { data: vendors } = useQuery({
    queryKey: queryKeys.vendorsSimple.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error: vendorsError } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("tenant_id", tenant.id);

      if (vendorsError) {
        logger.error('Failed to fetch vendors', vendorsError, { component: 'PurchaseOrders' });
        return [];
      }

      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  const vendorMap = new Map(vendors?.map(v => [v.id, v.name]) ?? []);

  const deleteMutation = deletePurchaseOrder;
  const updateStatusMutation = updatePurchaseOrderStatus;

  const filteredPOs = useMemo(() => purchaseOrders?.filter((po) => {
    const matchesSearch =
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) ?? [], [purchaseOrders, searchTerm]);

  // Calculate summary stats
  const { totalPOs, draftCount, pendingCount, totalValue } = useMemo(() => ({
    totalPOs: purchaseOrders?.length ?? 0,
    draftCount: purchaseOrders?.filter(po => po.status === 'draft').length ?? 0,
    pendingCount: purchaseOrders?.filter(po => ['sent', 'submitted', 'confirmed', 'approved'].includes(po.status ?? '')).length ?? 0,
    totalValue: purchaseOrders?.reduce((sum, po) => sum + Number(po.total ?? 0), 0) ?? 0,
  }), [purchaseOrders]);

  const handleCreate = () => {
    setEditingPO(null);
    setIsFormOpen(true);
  };

  const handleEdit = (po: PurchaseOrder) => {
    if (po.status === "draft") {
      setEditingPO(po);
      setIsFormOpen(true);
    } else {
      toast.error("Only draft purchase orders can be edited");
    }
  };

  const handleView = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsDetailOpen(true);
  };

  const handleDelete = (po: PurchaseOrder) => {
    if (po.status !== "draft" && po.status !== "cancelled") {
      toast.error("Only draft or cancelled purchase orders can be deleted");
      return;
    }

    confirm({
      title: 'Delete Purchase Order',
      itemName: po.po_number || undefined,
      itemType: 'purchase order',
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteMutation.mutateAsync({
            id: po.id,
            poNumber: po.po_number || undefined,
          });
          closeDialog();
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleStatusChange = async (po: PurchaseOrder, newStatus: string) => {
    await updateStatusMutation.mutateAsync({
      id: po.id,
      status: newStatus,
      poNumber: po.po_number || undefined,
    });
  };

  const getVendorName = (vendorId: string) => {
    return vendorMap.get(vendorId) || "Unknown Vendor";
  };

  const normalizeStatus = (status: string | null): string => {
    if (!status) return 'draft';
    // Map legacy statuses to new ones
    if (status === 'submitted') return 'sent';
    if (status === 'approved') return 'confirmed';
    return status;
  };

  if (error) {
    return (
      <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Failed to load purchase orders. Please try again.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Purchase Orders
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create and manage purchase orders from vendors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="min-h-[44px] touch-manipulation"
            onClick={() => setSearchParams({ tab: 'receiving' })}
          >
            <Truck className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline text-sm sm:text-base">Receiving</span>
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="text-sm sm:text-base">New PO</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total POs</p>
                <p className="text-xl font-bold">{totalPOs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-900/30 rounded-lg">
                <Edit className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Drafts</p>
                <p className="text-xl font-bold">{draftCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold">
                  ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                aria-label="Search by PO number or notes"
                placeholder="Search by PO number or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px] touch-manipulation"
              />
            </div>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[200px] min-h-[44px] touch-manipulation">
              <SelectValue placeholder="Filter by status" />
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
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders ({filteredPOs.length})</CardTitle>
          <CardDescription>
            Track purchase orders from creation to receipt. On receive, inventory is automatically updated.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPOs.length === 0 ? (
            <EnhancedEmptyState
              icon={Package}
              title={
                searchTerm
                  ? "No purchase orders match your search"
                  : statusFilter !== "all"
                    ? "No purchase orders found"
                    : "No purchase orders yet"
              }
              description={
                searchTerm
                  ? `No results for "${searchTerm}". Try a different search term or clear your search.`
                  : statusFilter !== "all"
                    ? "Try adjusting your filters to find purchase orders."
                    : "Create your first purchase order to start ordering from vendors."
              }
              primaryAction={
                searchTerm || statusFilter !== "all"
                  ? {
                      label: "Clear Filters",
                      onClick: () => {
                        setSearchTerm("");
                        setStatusFilter("all");
                      },
                    }
                  : {
                      label: "New Purchase Order",
                      onClick: handleCreate,
                      icon: Plus,
                    }
              }
              compact
              designSystem="tenant-admin"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPOs.map((po) => {
                    const displayStatus = normalizeStatus(po.status);
                    const StatusIcon = STATUS_ICONS[displayStatus] || FileText;
                    return (
                      <TableRow key={po.id} className="cursor-pointer" onClick={() => handleView(po)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleView(po); } }}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {po.po_number}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${STATUS_COLORS[displayStatus] || 'bg-gray-500 dark:bg-gray-600'} text-white border-0`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {STATUS_LABELS[displayStatus] || displayStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getVendorName(po.vendor_id) as string}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">-</span>
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
                        <TableCell>
                          {po.expected_delivery_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatSmartDate(po.expected_delivery_date)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {po.created_at
                            ? formatSmartDate(po.created_at)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(po)}
                              className="h-11 w-11 p-0"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {po.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(po)}
                                className="h-11 w-11 p-0"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {(po.status === "draft" || po.status === "cancelled") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(po)}
                                className="h-11 w-11 p-0 text-destructive hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
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

      {/* PO Form Dialog */}
      <POCreateForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        purchaseOrder={editingPO}
        onSuccess={() => {
          setIsFormOpen(false);
          setEditingPO(null);
        }}
      />

      {/* PO Detail Dialog */}
      {selectedPO && (
        <PODetail
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          purchaseOrder={selectedPO}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedPO);
          }}
          onStatusChange={handleStatusChange}
        />
      )}

      <ConfirmDeleteDialog
        open={dialogState.open}
        onOpenChange={(open) => !open && closeDialog()}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        description={dialogState.description}
        itemName={dialogState.itemName}
        itemType={dialogState.itemType}
        isLoading={dialogState.isLoading}
      />
    </div>
  );
}
