import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Plus,
  FileText,
  Calendar,
  DollarSign,
  Package,
  Edit,
  Trash2,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
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
import type { Database } from "@/integrations/supabase/types";

type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row'];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
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
  const { deletePurchaseOrder, updatePurchaseOrderStatus } = usePurchaseOrders();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: queryKeys.purchaseOrders.list({ status: statusFilter }),
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        logger.error('Failed to fetch purchase orders', error, { component: 'PurchaseOrdersPage' });
        throw error;
      }

      return (data || []) as PurchaseOrder[];
    },
  });

  const deleteMutation = deletePurchaseOrder;
  const updateStatusMutation = updatePurchaseOrderStatus;

  const filteredPOs = purchaseOrders?.filter((po) => {
    const matchesSearch =
      po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

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

  const handleDelete = async (po: PurchaseOrder) => {
    if (po.status !== "draft" && po.status !== "cancelled") {
      toast.error("Only draft or cancelled purchase orders can be deleted");
      return;
    }

    if (confirm(`Are you sure you want to delete ${po.po_number}?`)) {
      await deleteMutation.mutateAsync(po.id);
    }
  };

  const handleStatusChange = async (po: PurchaseOrder, newStatus: string) => {
    await updateStatusMutation.mutateAsync({ id: po.id, status: newStatus });
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            📋 Purchase Orders
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create and manage purchase orders from suppliers
          </p>
        </div>
        <Button
          className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
          onClick={handleCreate}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">New Purchase Order</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchase orders found. Create your first purchase order to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                      <TableRow key={po.id} className="cursor-pointer" onClick={() => handleView(po)}>
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
                            {Number(po.total || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {po.expected_delivery_date ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {new Date(po.expected_delivery_date).toLocaleDateString()}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {po.created_at
                            ? new Date(po.created_at).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(po)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {po.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(po)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {(po.status === "draft" || po.status === "cancelled") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(po)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
    </div>
  );
}

