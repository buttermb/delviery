import { logger } from '@/lib/logger';
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
  Tag,
  Calendar,
  DollarSign,
  Users,
  Edit,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
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
import { CouponCreateForm } from "@/components/admin/coupons/CouponCreateForm";
import { CouponAnalytics } from "@/components/admin/coupons/CouponAnalytics";
import { BulkCouponGenerator } from "@/components/admin/coupons/BulkCouponGenerator";
import { queryKeys } from "@/lib/queryKeys";
import type { Database } from "@/integrations/supabase/types";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import CopyButton from "@/components/CopyButton";

type Coupon = Database['public']['Tables']['coupon_codes']['Row'];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-500",
  expired: "bg-red-500",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  active: CheckCircle2,
  inactive: XCircle,
  expired: XCircle,
};

export default function CouponManagementPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isBulkGeneratorOpen, setIsBulkGeneratorOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

  const { data: coupons, isLoading } = useQuery({
    queryKey: queryKeys.coupons.list({ status: statusFilter, tenantId: tenant?.id }),
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      let query = (supabase
        .from("coupon_codes")
        .select("*") as any)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to fetch coupons', error, { component: 'CouponManagementPage' });
        throw error;
      }

      return (data || []) as Coupon[];
    },
    enabled: !!tenant?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await (supabase as any)
        .from("coupon_codes")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.lists() });
      toast.success("Coupon deleted successfully");
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete coupon', error, { component: 'CouponManagementPage' });
      toast.error("Failed to delete coupon");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await (supabase as any)
        .from("coupon_codes")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.lists() });
      toast.success("Coupon status updated");
    },
    onError: (error: unknown) => {
      logger.error('Failed to update coupon status', error, { component: 'CouponManagementPage' });
      toast.error("Failed to update status");
    },
  });

  const filteredCoupons = coupons?.filter((coupon) => {
    const matchesSearch =
      coupon.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.description?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

  const handleCreate = () => {
    setEditingCoupon(null);
    setIsFormOpen(true);
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setIsFormOpen(true);
  };

  const handleDelete = (coupon: Coupon) => {
    confirm({
      title: 'Delete Coupon',
      itemName: coupon.code,
      itemType: 'coupon',
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteMutation.mutateAsync(coupon.id);
          closeDialog();
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    const newStatus = coupon.status === "active" ? "inactive" : "active";
    await toggleStatusMutation.mutateAsync({ id: coupon.id, status: newStatus });
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}% off`;
    } else if (coupon.discount_type === "fixed") {
      return `$${coupon.discount_value} off`;
    } else if (coupon.discount_type === "free_shipping") {
      return "Free Shipping";
    } else if (coupon.discount_type === "bogo") {
      return "Buy One Get One";
    }
    return "Unknown";
  };

  const isExpired = (coupon: Coupon) => {
    if (coupon.never_expires) return false;
    if (!coupon.end_date) return false;
    return new Date(coupon.end_date) < new Date();
  };

  const isActive = (coupon: Coupon) => {
    if (coupon.status !== "active") return false;
    if (isExpired(coupon)) return false;
    if (coupon.start_date && new Date(coupon.start_date) > new Date()) return false;
    return true;
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            🎟️ Coupon Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create and manage discount coupons and promotions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsBulkGeneratorOpen(true)}
            className="min-h-[44px] touch-manipulation"
          >
            <Users className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Bulk Generate</span>
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="text-sm sm:text-base">New Coupon</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by code or description..."
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => setIsAnalyticsOpen(true)}
            className="min-h-[44px] touch-manipulation"
          >
            Analytics
          </Button>
        </div>
      </Card>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle>Coupons ({filteredCoupons.length})</CardTitle>
          <CardDescription>
            Manage discount codes and track usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCoupons.length === 0 ? (
            <EnhancedEmptyState
              icon={Tag}
              title="No Coupons Yet"
              description="Create your first coupon to start offering discounts to customers."
              primaryAction={{
                label: "Create Coupon",
                onClick: handleCreate,
                icon: Plus,
              }}
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Valid Dates</TableHead>
                    <TableHead>Constraints</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map((coupon) => {
                    const StatusIcon = STATUS_ICONS[coupon.status || "inactive"] || XCircle;
                    const expired = isExpired(coupon);
                    const active = isActive(coupon);
                    const displayStatus = expired ? "expired" : (coupon.status || "inactive");

                    return (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {coupon.code}
                            </code>
                            <CopyButton 
                              text={coupon.code} 
                              label="Code" 
                              size="icon" 
                              variant="ghost" 
                              showLabel={false}
                              className="h-6 w-6"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {getDiscountDisplay(coupon)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${STATUS_COLORS[displayStatus]} text-white border-0`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {coupon.used_count || 0}
                            {coupon.total_usage_limit && ` / ${coupon.total_usage_limit}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          {coupon.never_expires ? (
                            <span className="text-sm text-muted-foreground">Never expires</span>
                          ) : (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {coupon.start_date && coupon.end_date
                                ? `${new Date(coupon.start_date).toLocaleDateString()} - ${new Date(coupon.end_date).toLocaleDateString()}`
                                : "-"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {coupon.min_purchase && (
                              <div>Min: ${coupon.min_purchase}</div>
                            )}
                            {coupon.per_user_limit && (
                              <div>Per user: {coupon.per_user_limit}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(coupon)}
                              className="h-8 w-8 p-0"
                              title={coupon.status === "active" ? "Deactivate" : "Activate"}
                            >
                              {coupon.status === "active" ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(coupon)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(coupon)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {/* Coupon Form Dialog */}
      <CouponCreateForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        coupon={editingCoupon}
        onSuccess={() => {
          setIsFormOpen(false);
          setEditingCoupon(null);
        }}
      />

      {/* Analytics Dialog */}
      {isAnalyticsOpen && (
        <CouponAnalytics
          open={isAnalyticsOpen}
          onOpenChange={setIsAnalyticsOpen}
          coupons={coupons || []}
        />
      )}

      {/* Bulk Generator Dialog */}
      {isBulkGeneratorOpen && (
        <BulkCouponGenerator
          open={isBulkGeneratorOpen}
          onOpenChange={setIsBulkGeneratorOpen}
        />
      )}

      <ConfirmDeleteDialog
        open={dialogState.open}
        onOpenChange={(open) => !open && closeDialog()}
        onConfirm={dialogState.onConfirm}
        title={dialogState.title}
        itemName={dialogState.itemName}
        itemType={dialogState.itemType}
        isLoading={dialogState.isLoading}
      />
    </div>
  );
}

