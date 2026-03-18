/**
 * Storefront Coupons Page
 * Create and manage discount coupons for the store
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SaveButton } from '@/components/ui/SaveButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { showCopyToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
  Plus,
  Tag,
  Percent,
  DollarSign,
  Calendar,
  Copy,
  Trash2,
  Edit,
  CheckCircle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { queryKeys } from '@/lib/queryKeys';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CouponRow = Database['public']['Tables']['marketplace_coupons']['Row'];

interface CouponFormData {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  min_order_amount: string;
  usage_limit: string;
  end_date: string;
}

const initialFormData: CouponFormData = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  min_order_amount: '',
  usage_limit: '',
  end_date: '',
};

export default function StorefrontCoupons() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;
  const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [formData, setFormData] = useState<CouponFormData>(initialFormData);

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
    retry: 2,
  });

  // Fetch coupons
  const { data: coupons = [], isLoading } = useQuery({
    queryKey: queryKeys.storefrontCoupons.byStore(store?.id),
    queryFn: async () => {
      if (!store?.id || !tenantId) return [];

      const { data, error } = await supabase
        .from('marketplace_coupons')
        .select('id, code, discount_type, discount_value, min_order_amount, usage_limit, used_count, is_active, end_date, created_at, max_discount_amount, store_id, start_date, description, updated_at')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as CouponRow[];
    },
    enabled: !!store?.id && !!tenantId,
    retry: 2,
  });

  // Create/Update coupon mutation
  const saveCouponMutation = useMutation({
    mutationFn: async (data: CouponFormData) => {
      if (!store?.id || !tenantId) throw new Error('No store');

      const couponData = {
        store_id: store.id,
        code: data.code.toUpperCase().trim(),
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        min_order_amount: data.min_order_amount ? parseFloat(data.min_order_amount) : null,
        usage_limit: data.usage_limit ? parseInt(data.usage_limit, 10) : null,
        end_date: data.end_date || null,
        is_active: true,
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from('marketplace_coupons')
          .update(couponData)
          .eq('id', editingCoupon.id)
          .eq('store_id', store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketplace_coupons')
          .insert(couponData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontCoupons.all });
      setIsDialogOpen(false);
      const savedCode = formData.code.toUpperCase();
      setFormData(initialFormData);
      setEditingCoupon(null);
      toast.success(`Coupon ${savedCode} has been saved.`);
    },
    onError: (error: unknown) => {
      logger.error('Failed to save coupon', error, { component: 'StorefrontCoupons' });
      toast.error('Error', { description: humanizeError(error) });
    },
  });

  // Toggle coupon status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!store?.id) throw new Error('No store');
      const { error } = await supabase
        .from('marketplace_coupons')
        .update({ is_active: isActive })
        .eq('id', id)
        .eq('store_id', store.id);
      if (error) throw error;
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontCoupons.all });
      toast.success(isActive ? 'Coupon activated' : 'Coupon deactivated');
    },
    onError: (error: unknown) => {
      logger.error('Failed to toggle coupon status', error, { component: 'StorefrontCoupons' });
      toast.error('Error', { description: humanizeError(error) });
    },
  });

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!store?.id) throw new Error('No store');
      const { error } = await supabase
        .from('marketplace_coupons')
        .delete()
        .eq('id', id)
        .eq('store_id', store.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storefrontCoupons.all });
      toast.success('Coupon deleted');
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete coupon', error, { component: 'StorefrontCoupons' });
      toast.error('Error', { description: humanizeError(error) });
    },
  });

  const openCreateDialog = () => {
    setEditingCoupon(null);
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (coupon: CouponRow) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type as 'percentage' | 'fixed',
      discount_value: coupon.discount_value.toString(),
      min_order_amount: coupon.min_order_amount?.toString() ?? '',
      usage_limit: coupon.usage_limit?.toString() ?? '',
      end_date: coupon.end_date?.split('T')[0] ?? '',
    });
    setIsDialogOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showCopyToast('Coupon code');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setFormData((prev) => ({ ...prev, code }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.discount_value) {
      toast.error('Please fill in the required fields');
      return;
    }
    saveCouponMutation.mutate(formData);
  };

  if (!store) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCoupons = coupons.filter((c) => c.is_active);
  const totalUses = coupons.reduce((sum, c) => sum + (c.used_count ?? 0), 0);

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Promo Codes</h1>
          <p className="text-muted-foreground">
            {activeCoupons.length} active · {totalUses} total uses
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
              </DialogTitle>
              <DialogDescription>
                {editingCoupon
                  ? 'Update the coupon details below'
                  : 'Create a new discount coupon for your store'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="SAVE20"
                    className="uppercase"
                  />
                  <Button type="button" variant="outline" onClick={generateCode}>
                    Generate
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount_type">Discount Type</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(value: 'percentage' | 'fixed') =>
                      setFormData((prev) => ({ ...prev, discount_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select discount type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount_value">
                    Discount Value *
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, discount_value: e.target.value }))
                    }
                    placeholder={formData.discount_type === 'percentage' ? '20' : '10.00'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min_order_amount">Minimum Order ($)</Label>
                  <Input
                    id="min_order_amount"
                    type="number"
                    step="0.01"
                    value={formData.min_order_amount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, min_order_amount: e.target.value }))
                    }
                    placeholder="50.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usage_limit">Max Uses</Label>
                  <Input
                    id="usage_limit"
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, usage_limit: e.target.value }))
                    }
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Expiration Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, end_date: e.target.value }))
                  }
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <SaveButton
                  type="submit"
                  isPending={saveCouponMutation.isPending}
                  isSuccess={saveCouponMutation.isSuccess}
                >
                  Save Coupon
                </SaveButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Coupons</p>
                <p className="text-2xl font-bold">{coupons.length}</p>
              </div>
              <Tag className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Coupons</p>
                <p className="text-2xl font-bold">{activeCoupons.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Uses</p>
                <p className="text-2xl font-bold">{totalUses}</p>
              </div>
              <Percent className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={`skeleton-${i}`} className="h-16" />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-semibold">No coupons yet</p>
              <p className="text-sm">Create your first discount coupon</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create Coupon
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Min Order</TableHead>
                  <TableHead className="text-center">Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const isExpired = coupon.end_date != null && new Date(coupon.end_date) < new Date();
                  const isMaxedOut = coupon.usage_limit != null && (coupon.used_count ?? 0) >= coupon.usage_limit;

                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-semibold bg-muted px-2 py-1 rounded">
                            {coupon.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 sm:h-6 sm:w-6"
                            onClick={() => copyCode(coupon.code)}
                            aria-label="Copy coupon code"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {coupon.discount_type === 'percentage' ? (
                            <>
                              <Percent className="w-4 h-4 text-muted-foreground" />
                              {coupon.discount_value}%
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4 text-muted-foreground" />
                              {coupon.discount_value.toFixed(2)}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {coupon.min_order_amount
                          ? formatCurrency(coupon.min_order_amount)
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">
                          {coupon.used_count ?? 0} / {coupon.usage_limit ?? '∞'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {coupon.end_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3" />
                            {formatSmartDate(coupon.end_date)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-700">
                            Expired
                          </Badge>
                        ) : isMaxedOut ? (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">
                            Maxed Out
                          </Badge>
                        ) : coupon.is_active ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-700">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={coupon.is_active ?? false}
                            onCheckedChange={(checked) =>
                              toggleStatusMutation.mutate({ id: coupon.id, isActive: checked })
                            }
                            disabled={isExpired || isMaxedOut}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(coupon)}
                            aria-label="Edit coupon"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete coupon"
                            onClick={() => {
                              confirm({
                                title: 'Delete Coupon',
                                itemName: coupon.code,
                                itemType: 'coupon',
                                onConfirm: async () => {
                                  setLoading(true);
                                  try {
                                    await deleteCouponMutation.mutateAsync(coupon.id);
                                    closeDialog();
                                  } finally {
                                    setLoading(false);
                                  }
                                },
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
