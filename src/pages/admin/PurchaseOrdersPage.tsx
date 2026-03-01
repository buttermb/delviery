import { logger } from '@/lib/logger';
import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/queryKeys";
import { formatSmartDate } from '@/lib/formatters';
import { TruncatedText } from '@/components/shared/TruncatedText';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';
import type { Database } from "@/integrations/supabase/types";

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500 dark:bg-gray-600",
  submitted: "bg-blue-500",
  approved: "bg-green-500",
  received: "bg-emerald-500",
  cancelled: "bg-red-500",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  draft: FileText,
  submitted: Clock,
  approved: CheckCircle2,
  received: CheckCircle2,
  cancelled: XCircle,
};

export default function PurchaseOrdersPage() {
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
  const { data: purchaseOrders, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.purchaseOrders.list({ status: statusFilter, tenantId: tenant?.id }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from("purchase_orders")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch purchase orders', error, { component: 'PurchaseOrdersPage' });
        throw error;
      }

      return (data ?? []) as PurchaseOrder[];
    },
    enabled: !!tenant?.id,
  });

  const deleteMutation = deletePurchaseOrder;
  const updateStatusMutation = updatePurchaseOrderStatus;

  const filteredPOs = purchaseOrders?.filter((po) => {
    const matchesSearch =
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) ?? [];

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

  if (isLoading) {
    return (
      <div className="space-y-4 p-2 sm:p-4 md:p-4" role="status" aria-label="Loading purchase orders...">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-44" />
          </div>
        </div>
        <Skeleton className="h-14 w-full rounded-lg" />
        <div className="rounded-lg border bg-card">
          <div className="p-6 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="px-6 pb-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return <PageErrorState onRetry={() => refetch()} message="Failed to load purchase orders. Please try again." />;
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
            Create and manage purchase orders from suppliers
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
            <span className="text-sm sm:text-base">New Purchase Order</span>
          </Button>
        </div>
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
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
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
            Track purchase orders from creation to receipt
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchase orders found. Create your first purchase order to get started.
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {filteredPOs.map((po) => {
                  const StatusIcon = STATUS_ICONS[po.status || "draft"] || FileText;
                  return (
                    <div
                      key={po.id}
                      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors space-y-3"
                      onClick={() => handleView(po)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleView(po); } }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <TruncatedText text={po.po_number} className="font-semibold text-sm" />
                        </div>
                        <Badge
                          variant="outline"
                          className={`${STATUS_COLORS[po.status || "draft"]} text-white border-0 shrink-0`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {(po.status || "draft").charAt(0).toUpperCase() + (po.status || "draft").slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate">Vendor: {po.vendor_id.substring(0, 8)}...</span>
                        <span className="font-bold">
                          ${Number(po.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>
                          {po.expected_delivery_date
                            ? `Due: ${formatSmartDate(po.expected_delivery_date)}`
                            : 'No delivery date'}
                        </span>
                        <span>{po.created_at ? formatSmartDate(po.created_at) : '-'}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1" role="presentation" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => handleView(po)} className="h-9 w-9 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {po.status === "draft" && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(po)} className="h-9 w-9 p-0">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {(po.status === "draft" || po.status === "cancelled") && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(po)} className="h-9 w-9 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPOs.map((po) => {
                      const StatusIcon = STATUS_ICONS[po.status || "draft"] || FileText;
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
                              className={`${STATUS_COLORS[po.status || "draft"]} text-white border-0`}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {(po.status || "draft").charAt(0).toUpperCase() + (po.status || "draft").slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">Vendor ID: {po.vendor_id.substring(0, 8)}...</span>
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
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {po.created_at
                              ? formatSmartDate(po.created_at)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2" role="presentation" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(po)}
                                className="h-11 w-11 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {po.status === "draft" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(po)}
                                  className="h-11 w-11 p-0"
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
            </>
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
