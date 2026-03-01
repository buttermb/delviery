import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Truck, Plus, Package, Loader2 } from 'lucide-react';
import { formatSmartDate } from '@/lib/formatters';
import { handleError } from "@/utils/errorHandling/handlers";
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';
import { queryKeys } from '@/lib/queryKeys';

interface TransferFormData {
  product_id: string;
  from_warehouse: string;
  to_warehouse: string;
  quantity_lbs: string;
  notes: string;
}

interface TransferRow {
  id: string;
  product_id: string;
  from_warehouse: string;
  to_warehouse: string;
  quantity_lbs: number;
  notes: string | null;
  status: string;
  created_at: string;
  product?: { name: string } | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

interface LocationOption {
  id: string;
  name: string;
}

export default function InventoryTransfers() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    from_warehouse: '',
    to_warehouse: '',
    quantity_lbs: '',
    notes: '',
  });

  // Fetch products for dropdown
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.inventoryTransfersAdmin.products(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('tenant_id', tenantId)
        .eq('in_stock', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Fetch locations for dropdowns
  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.inventoryTransfersAdmin.locations(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('inventory_locations')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .order('name');
        if (error && error.code === '42P01') {
          // Table doesn't exist, return default locations
          return [
            { id: 'warehouse-main', name: 'Main Warehouse' },
            { id: 'warehouse-secondary', name: 'Secondary Warehouse' },
          ];
        }
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') {
          return [
            { id: 'warehouse-main', name: 'Main Warehouse' },
            { id: 'warehouse-secondary', name: 'Secondary Warehouse' },
          ];
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const { data: transfers, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.inventoryTransfersAdmin.transfers(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('inventory_transfers')
          .select('*, product:products(*)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createTransferMutation = useMutation({
    mutationFn: async (transfer: TransferFormData) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('inventory_transfers')
        .insert({
          product_id: transfer.product_id,
          from_location_id: transfer.from_warehouse,
          to_location_id: transfer.to_warehouse,
          quantity: parseFloat(transfer.quantity_lbs),
          notes: transfer.notes || null,
          status: 'pending',
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Inventory transfers table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryTransfersAdmin.transfers(tenantId) });
      toast.success("Inventory transfer has been created.");
      setFormData({
        product_id: '',
        from_warehouse: '',
        to_warehouse: '',
        quantity_lbs: '',
        notes: '',
      });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      handleError(error, {
        component: 'InventoryTransfers.createTransfer',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.product_id) {
      toast.error("Please select a product");
      return;
    }
    if (!formData.from_warehouse) {
      toast.error("Please select origin location");
      return;
    }
    if (!formData.to_warehouse) {
      toast.error("Please select destination location");
      return;
    }
    if (formData.from_warehouse === formData.to_warehouse) {
      toast.error("Origin and destination must be different");
      return;
    }
    if (!formData.quantity_lbs || parseFloat(formData.quantity_lbs) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    createTransferMutation.mutate(formData);
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="table" message="Loading transfers..." />;
  }

  if (isError) {
    return <PageErrorState onRetry={() => refetch()} message="Failed to load inventory transfers. Please try again." />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Inventory Transfers</h1>
          <p className="text-muted-foreground">Manage inventory transfers between locations</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {transfers && transfers.length > 0 ? (
        <div className="space-y-4">
          {transfers.map((transfer: TransferRow) => (
            <Card key={transfer.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    <CardTitle>Transfer #{transfer.id.slice(0, 8)}</CardTitle>
                  </div>
                  <Badge variant={transfer.status === 'completed' ? 'default' : 'secondary'}>
                    {transfer.status || 'pending'}
                  </Badge>
                </div>
                <CardDescription>
                  {transfer.from_warehouse} → {transfer.to_warehouse}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium">Quantity</div>
                    <div className="text-lg">{transfer.quantity_lbs} lbs</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Date</div>
                    <div className="text-sm text-muted-foreground">
                      {formatSmartDate(transfer.created_at)}
                    </div>
                  </div>
                  {transfer.notes && (
                    <div className="col-span-2">
                      <div className="text-sm font-medium">Notes</div>
                      <div className="text-sm text-muted-foreground">{transfer.notes}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EnhancedEmptyState
          icon={Package}
          title="No Transfers Found"
          description="No inventory transfers found. Create your first transfer to get started."
          primaryAction={{
            label: "Create Transfer",
            onClick: () => setIsDialogOpen(true),
            icon: Plus
          }}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Transfer</DialogTitle>
            <DialogDescription>
              Transfer inventory between warehouses
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="product_id">Product *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product: ProductOption) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} {product.sku ? `(${product.sku})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_warehouse">From Location *</Label>
                <Select
                  value={formData.from_warehouse}
                  onValueChange={(value) => setFormData({ ...formData, from_warehouse: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select origin location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc: LocationOption) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="to_warehouse">To Location *</Label>
                <Select
                  value={formData.to_warehouse}
                  onValueChange={(value) => setFormData({ ...formData, to_warehouse: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations
                      .filter((loc: LocationOption) => loc.id !== formData.from_warehouse)
                      .map((loc: LocationOption) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_lbs">Quantity (lbs) *</Label>
                <Input
                  id="quantity_lbs"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.quantity_lbs}
                  onChange={(e) => setFormData({ ...formData, quantity_lbs: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  placeholder="Transfer reason or additional details..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTransferMutation.isPending}>
                {createTransferMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

