/**
 * Warehouses Page
 * Manage warehouse locations and their inventory
 */

import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Warehouse, Package, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';

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

const warehouseFormSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required').max(100, 'Name must be 100 characters or less'),
  address: z.string().max(255, 'Address must be 255 characters or less').optional().default(''),
});

type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

function WarehousesPageSkeleton() {
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      {/* Table */}
      <div className="border rounded-lg p-4 sm:p-6">
        <div className="hidden md:grid grid-cols-5 gap-4 p-3 border-b bg-muted/50 rounded-t-md">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-4 w-20" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`row-${i}`} className="hidden md:grid grid-cols-5 gap-4 p-3 border-b last:border-b-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
        {/* Mobile skeleton */}
        <div className="md:hidden space-y-3 mt-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`mobile-${i}`} className="border rounded-lg p-3 space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`stat-${i}`} className="border rounded-lg p-3 sm:p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WarehousesPage() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: { name: '', address: '' },
  });

  const { data: warehouses, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.warehouses.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data: inventory, error } = await supabase
          .from('products')
          .select('category, stock_quantity, cost_per_unit')
          .eq('tenant_id', tenantId);

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
    retry: 2,
    staleTime: 60_000,
  });

  const columns: ColumnDef<WarehouseLocation>[] = [
    {
      accessorKey: 'location',
      header: 'Warehouse',
      cell: ({ original }) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium truncate max-w-[200px]">{original.location}</span>
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
            aria-label={`View inventory for ${original.location}`}
            onClick={() => {
              navigate(`/admin/inventory-hub?tab=products&warehouse=${encodeURIComponent(original.location)}`);
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
    mutationFn: async (warehouse: WarehouseFormValues) => {
      if (!tenantId) throw new Error('Tenant ID missing');

      // warehouses table may not exist in all tenant schemas
      const sb = supabase as unknown as Record<string, (...args: unknown[]) => unknown> & typeof supabase;
      const { error } = await sb.from('warehouses' as never).insert([{
        name: warehouse.name,
        address: warehouse.address || null,
        tenant_id: tenantId,
      }]) as unknown as { error: { code: string; message: string } | null };

      if (error && error.code === '42P01') {
        return;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Warehouse added successfully');
      setIsDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
    },
    onError: (error: unknown) => {
      toast.error('Failed to add warehouse', { description: humanizeError(error) });
    },
  });

  const handleSave = (values: WarehouseFormValues) => {
    createWarehouse.mutate(values);
  };

  if (isLoading && !warehouses) {
    return <WarehousesPageSkeleton />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold">Warehouses</h1>
            {isFetching && !isLoading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage warehouse locations and track inventory by location
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) form.reset();
        }}>
          <DialogTrigger asChild>
            <Button aria-label="Add new warehouse" className="min-h-[44px]">
              <Plus className="h-4 w-4 mr-2" />
              Add Warehouse
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Warehouse</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <div>
                <Label htmlFor="warehouse-name">Warehouse Name</Label>
                <Input
                  id="warehouse-name"
                  {...form.register('name')}
                  placeholder="e.g., Main Warehouse, Downtown"
                  maxLength={100}
                  aria-invalid={!!form.formState.errors.name}
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="warehouse-address">Address (Optional)</Label>
                <Input
                  id="warehouse-address"
                  {...form.register('address')}
                  placeholder="123 Main St, City, State"
                  maxLength={255}
                  aria-invalid={!!form.formState.errors.address}
                />
                {form.formState.errors.address && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.address.message}</p>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); form.reset(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createWarehouse.isPending} className="min-h-[44px]">
                  {createWarehouse.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Warehouse className="h-4 w-4 mr-2" />
                  )}
                  Add Warehouse
                </Button>
              </DialogFooter>
            </form>
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
        <Card className="p-4 sm:p-6">
          <DataTable
            columns={columns}
            data={warehouses ?? []}
            loading={isLoading}
            emptyMessage="No warehouses found. Add your first warehouse location!"
          />
        </Card>
      )}

      {/* Warehouse Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Warehouses</div>
          <div className="text-lg sm:text-2xl font-bold truncate">{warehouses?.length ?? 0}</div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Inventory</div>
          <div className="text-lg sm:text-2xl font-bold truncate">
            {warehouses?.reduce((sum, w) => sum + Number(w.total_quantity ?? 0), 0).toFixed(1) ?? 0}{' '}
            lbs
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-lg sm:text-2xl font-bold truncate">
            $
            {warehouses
              ?.reduce((sum, w) => sum + Number(w.total_value ?? 0), 0)
              .toFixed(2) || '0.00'}
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Products</div>
          <div className="text-lg sm:text-2xl font-bold truncate">
            {warehouses?.reduce((sum, w) => sum + Number(w.product_count ?? 0), 0) ?? 0}
          </div>
        </Card>
      </div>
    </div>
  );
}
