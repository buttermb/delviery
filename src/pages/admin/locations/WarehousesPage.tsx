/**
 * Warehouses Page
 * Manage warehouse locations and their inventory
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { Plus, Warehouse, MapPin, Package, DollarSign } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

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
  const { account } = useAccount();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
  });

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['warehouses', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      // Get inventory grouped by warehouse location
      const { data: inventory } = await supabase
        .from('wholesale_inventory')
        .select('warehouse_location, quantity_lbs, cost_per_lb')
        .eq('account_id', account.id);

      const warehouseMap = new Map<string, WarehouseLocation>();

      (inventory || []).forEach((item: any) => {
        const loc = item.warehouse_location || 'Unknown';
        if (!warehouseMap.has(loc)) {
          warehouseMap.set(loc, {
            location: loc,
            total_value: 0,
            total_quantity: 0,
            product_count: 0,
          });
        }
        const wh = warehouseMap.get(loc)!;
        wh.total_quantity += Number(item.quantity_lbs || 0);
        wh.total_value += Number(item.quantity_lbs || 0) * Number(item.cost_per_lb || 0);
        wh.product_count += 1;
      });

      return Array.from(warehouseMap.values()).sort((a, b) =>
        a.location.localeCompare(b.location)
      );
    },
    enabled: !!account?.id,
  });

  const columns: ColumnDef<WarehouseLocation>[] = [
    {
      accessorKey: 'location',
      header: 'Warehouse',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.location}</span>
        </div>
      ),
    },
    {
      accessorKey: 'product_count',
      header: 'Products',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.product_count} items</Badge>
      ),
    },
    {
      accessorKey: 'total_quantity',
      header: 'Total Quantity',
      cell: ({ row }) => `${Number(row.original.total_quantity).toFixed(1)} lbs`,
    },
    {
      accessorKey: 'total_value',
      header: 'Total Value',
      cell: ({ row }) => (
        <div className="font-medium">
          ${Number(row.original.total_value).toFixed(2)}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Navigate to inventory filtered by warehouse
              window.location.href = `/admin/big-plug-inventory?warehouse=${encodeURIComponent(
                row.original.location
              )}`;
            }}
          >
            <Package className="h-4 w-4 mr-1" />
            View Inventory
          </Button>
        </div>
      ),
    },
  ];

  const handleSave = async () => {
    try {
      // TODO: Save warehouse to database if you have a warehouses table
      showSuccessToast('Warehouse added successfully');
      setIsDialogOpen(false);
      setFormData({ name: '', address: '' });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    } catch (error) {
      showErrorToast('Failed to add warehouse');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🏢 Warehouses</h1>
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Warehouse className="h-4 w-4 mr-2" />
                  Add Warehouse
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <DataTable
          columns={columns}
          data={warehouses || []}
          loading={isLoading}
          emptyMessage="No warehouses found. Add your first warehouse location!"
        />
      </Card>

      {/* Warehouse Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Warehouses</div>
          <div className="text-2xl font-bold">{warehouses?.length || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Inventory</div>
          <div className="text-2xl font-bold">
            {warehouses?.reduce((sum, w) => sum + Number(w.total_quantity || 0), 0).toFixed(1) || 0}{' '}
            lbs
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-2xl font-bold">
            $
            {warehouses
              ?.reduce((sum, w) => sum + Number(w.total_value || 0), 0)
              .toFixed(2) || '0.00'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Products</div>
          <div className="text-2xl font-bold">
            {warehouses?.reduce((sum, w) => sum + Number(w.product_count || 0), 0) || 0}
          </div>
        </Card>
      </div>
    </div>
  );
}

