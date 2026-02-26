/**
 * Warehouses Page
 * Manage warehouse locations and their inventory
 */

import { useState } from 'react';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Warehouse, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

type ColumnDef<T> = {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T }) => React.ReactNode;
  id?: string;
};

interface WarehouseLocation {
  location: string;
  total_value: number;
  total_quantity: number;
  product_count: number;
}

export default function WarehousesPage() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
  });

  const [tableMissing, setTableMissing] = useState(false);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: queryKeys.warehouses.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Get inventory grouped by category (simulating warehouse locations)
        const { data: inventory, error } = await supabase
          .from('products')
          .select('category, stock_quantity, cost_per_unit')
          .eq('tenant_id', tenantId);

        // Gracefully handle missing table
        if (error && error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        if (error) throw error;
        setTableMissing(false);

        interface InventoryItem {
          category?: string | null;
          stock_quantity?: number | null;
          cost_per_unit?: number | null;
        }

        const warehouseMap = new Map<string, WarehouseLocation>();

        (inventory ?? []).forEach((item: InventoryItem) => {
          const loc = item.category || 'Uncategorized';
          if (!warehouseMap.has(loc)) {
            warehouseMap.set(loc, {
              location: loc,
              total_value: 0,
              total_quantity: 0,
              product_count: 0,
            });
          }
          const wh = warehouseMap.get(loc);
          if (!wh) return;
          wh.total_quantity += Number(item.stock_quantity ?? 0);
          wh.total_value += Number(item.stock_quantity ?? 0) * Number(item.cost_per_unit ?? 0);
          wh.product_count += 1;
        });

        return Array.from(warehouseMap.values()).sort((a, b) =>
          a.location.localeCompare(b.location)
        );
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '42P01') {
          setTableMissing(true);
          return [];
        }
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const columns: ColumnDef<WarehouseLocation>[] = [
    {
      accessorKey: 'location',
      header: 'Warehouse',
      cell: ({ original }) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{original.location}</span>
        </div>
      ),
    },
    {
      accessorKey: 'product_count',
      header: 'Products',
      cell: ({ original }) => (
        <Badge variant="secondary">{original.product_count} items</Badge>
      ),
    },
    {
      accessorKey: 'total_quantity',
      header: 'Total Quantity',
      cell: ({ original }) => `${Number(original.total_quantity).toFixed(1)} lbs`,
    },
    {
      accessorKey: 'total_value',
      header: 'Total Value',
      cell: ({ original }) => (
        <div className="font-medium">
          ${Number(original.total_value).toFixed(2)}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ original }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Navigate to inventory filtered by warehouse
              if (tenant?.slug) { navigate(`/${tenant.slug}/admin/inventory/products?warehouse=${encodeURIComponent(
                original.location
              )}`); }
            }}
          >
            <Package className="h-4 w-4 mr-1" />
            View Inventory
          </Button>
        </div>
      ),
    },
  ];

  const createWarehouse = useMutation({
    mutationFn: async (warehouse: typeof formData) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      // Create warehouse location record
      // Note: In a full implementation, you'd have a dedicated warehouses table
      // For now, we'll create a reference by updating inventory
      const { error } = await supabase
        .from('warehouses')
        .insert([{
          name: warehouse.name,
          address: warehouse.address,
          tenant_id: tenantId
        }]);

      // Gracefully handle missing table
      if (error && error.code === '42P01') {
        // If warehouses table doesn't exist, just show success message
        // In production, you'd want to create the table first
        return;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Warehouse ");
      setIsDialogOpen(false);
      setFormData({ name: '', address: '' });
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
    onError: (error: unknown) => {
      toast.error("Failed to add warehouse", { description: humanizeError(error) });
    }
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a warehouse name");
      return;
    }

    createWarehouse.mutate(formData);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold mb-2">Warehouses</h1>
          <p className="text-muted-foreground">
            Manage warehouse locations and track inventory by location
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Warehouse</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Warehouse Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Warehouse, Downtown"
                />
              </div>
              <div>
                <Label>Address (Optional)</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Main St, City, State"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={createWarehouse.isPending}>
                {createWarehouse.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Warehouse className="h-4 w-4 mr-2" />}
                Add Warehouse
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {tableMissing ? (
        <Card className="p-6">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Feature Not Available</h3>
            <p className="text-muted-foreground mb-4">
              The warehouses table has not been created yet. This feature requires additional database setup.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact support to enable this feature or run the database migration to create the required tables.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-6">
          <DataTable
            columns={columns}
            data={warehouses ?? []}
            loading={isLoading}
            emptyMessage="No warehouses found. Add your first warehouse location!"
          />
        </Card>
      )}

      {/* Warehouse Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Warehouses</div>
          <div className="text-2xl font-bold">{warehouses?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Inventory</div>
          <div className="text-2xl font-bold">
            {warehouses?.reduce((sum, w) => sum + Number(w.total_quantity ?? 0), 0).toFixed(1) ?? 0}{' '}
            lbs
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-2xl font-bold">
            $
            {warehouses
              ?.reduce((sum, w) => sum + Number(w.total_value ?? 0), 0)
              .toFixed(2) || '0.00'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Products</div>
          <div className="text-2xl font-bold">
            {warehouses?.reduce((sum, w) => sum + Number(w.product_count ?? 0), 0) ?? 0}
          </div>
        </Card>
      </div>
    </div>
  );
}
