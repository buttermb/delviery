import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Plus,
  RotateCcw,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Edit,
  Trash2,
  Eye,
  Loader2,
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
import { RACreateForm } from "@/components/admin/returns/RACreateForm";
import { RADetail } from "@/components/admin/returns/RADetail";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

interface ReturnAuthorization {
  id: string;
  ra_number: string;
  order_id: string;
  order_number?: string;
  customer_id?: string;
  customer_name?: string;
  status: "pending" | "received" | "processed" | "refunded" | "exchanged" | "cancelled";
  reason: string;
  return_method: "pickup" | "ship_back" | "destroy";
  total_amount: number;
  refund_amount?: number;
  restocking_fee?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  received_at?: string;
  processed_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  received: "bg-blue-500",
  processed: "bg-purple-500",
  refunded: "bg-green-500",
  exchanged: "bg-emerald-500",
  cancelled: "bg-red-500",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  received: Package,
  processed: AlertCircle,
  refunded: CheckCircle2,
  exchanged: CheckCircle2,
  cancelled: XCircle,
};

export default function ReturnsManagementPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRA, setSelectedRA] = useState<ReturnAuthorization | null>(null);
  const [editingRA, setEditingRA] = useState<ReturnAuthorization | null>(null);

  // For now, we'll use a mock query since the returns table may not exist
  // In production, this would query the actual returns table
  // @ts-expect-error - return_authorizations table not in types yet
  const { data: returns, isLoading } = useQuery({
    queryKey: queryKeys.returns.list({ status: statusFilter }),
    queryFn: async () => {
      // @ts-expect-error - return_authorizations table not in types yet
      let query = supabase
        .from("return_authorizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
        
      if (error) {
        logger.error('Failed to fetch returns', error, { component: 'ReturnsManagementPage' });
        return [];
      }

      return (data || []) as ReturnAuthorization[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("returns")
        .delete()
        .eq("id", id);

      if (error && error.code !== "42P01") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.returns.lists() });
      toast.success("Return authorization deleted successfully");
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete return authorization', error, { component: 'ReturnsManagementPage' });
      toast.error("Failed to delete return authorization");
    },
  });

  const filteredReturns = returns?.filter((ra) => {
    const matchesSearch =
      ra.ra_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ra.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ra.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ra.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

  const handleCreate = () => {
    setEditingRA(null);
    setIsFormOpen(true);
  };

  const handleEdit = (ra: ReturnAuthorization) => {
    if (ra.status === "pending") {
      setEditingRA(ra);
      setIsFormOpen(true);
    } else {
      toast.error("Only pending return authorizations can be edited");
    }
  };

  const handleView = (ra: ReturnAuthorization) => {
    setSelectedRA(ra);
    setIsDetailOpen(true);
  };

  const handleDelete = async (ra: ReturnAuthorization) => {
    if (ra.status !== "pending" && ra.status !== "cancelled") {
      toast.error("Only pending or cancelled returns can be deleted");
      return;
    }

    if (confirm(`Are you sure you want to delete ${ra.ra_number}?`)) {
      await deleteMutation.mutateAsync(ra.id);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            🔄 Returns & Refunds
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage product returns, refunds, and exchanges
          </p>
        </div>
        <Button
          className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
          onClick={handleCreate}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">New Return Authorization</span>
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
                placeholder="Search by RA number, order number, or customer..."
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="exchanged">Exchanged</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Return Authorizations ({filteredReturns.length})</CardTitle>
          <CardDescription>
            Track returns from authorization to refund/exchange
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {returns && returns.length === 0 && searchTerm === "" && statusFilter === "all" ? (
                <>
                  <RotateCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No return authorizations found.</p>
                  <p className="text-sm mt-2">Create your first return authorization to get started.</p>
                </>
              ) : (
                "No returns match your search criteria."
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RA Number</TableHead>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.map((ra) => {
                    const StatusIcon = STATUS_ICONS[ra.status] || Clock;
                    return (
                      <TableRow key={ra.id} className="cursor-pointer" onClick={() => handleView(ra)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <RotateCcw className="h-4 w-4 text-muted-foreground" />
                            {ra.ra_number}
                          </div>
                        </TableCell>
                        <TableCell>{ra.order_number || "-"}</TableCell>
                        <TableCell>{ra.customer_name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${STATUS_COLORS[ra.status]} text-white border-0`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {ra.status.charAt(0).toUpperCase() + ra.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{ra.reason}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            ${Number(ra.total_amount || 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {ra.created_at
                            ? new Date(ra.created_at).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleView(ra)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {ra.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(ra)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {(ra.status === "pending" || ra.status === "cancelled") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(ra)}
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

      {/* RA Form Dialog */}
      <RACreateForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        returnAuth={editingRA}
        onSuccess={() => {
          setIsFormOpen(false);
          setEditingRA(null);
        }}
      />

      {/* RA Detail Dialog */}
      {selectedRA && (
        <RADetail
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          returnAuth={selectedRA}
          onEdit={() => {
            setIsDetailOpen(false);
            handleEdit(selectedRA);
          }}
        />
      )}
    </div>
  );
}

