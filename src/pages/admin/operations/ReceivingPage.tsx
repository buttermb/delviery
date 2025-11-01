/**
 * Receiving & Packaging Page
 * Receive inventory, create batches, and package products
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Package, Receipt, Barcode, Warehouse } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
// ColumnDef type - simplified version
type ColumnDef<T> = {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (row: { original: T }) => React.ReactNode;
  id?: string;
};
import { format } from 'date-fns';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

interface ReceivingRecord {
  id: string;
  batch_number: string;
  product_id: string;
  quantity_lbs: number;
  cost_per_lb: number;
  received_date: string;
  status: string;
  warehouse_location: string;
  received_by?: string;
  products?: {
    name: string;
  };
}

export default function ReceivingPage() {
  const { account } = useAccount();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    quantity_lbs: '',
    cost_per_lb: '',
    warehouse_location: '',
    expiration_date: '',
  });

  const { data: receivingRecords, isLoading } = useQuery({
    queryKey: ['receiving-records', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data, error } = await supabase
        .from('inventory_batches')
        .select(`
          id,
          batch_number,
          product_id,
          quantity_lbs,
          cost_per_lb,
          received_date,
          status,
          warehouse_location,
          products:products(
            name
          )
        `)
        .eq('account_id', account.id)
        .order('received_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ReceivingRecord[];
    },
    enabled: !!account?.id,
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-receiving', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .eq('account_id', account.id)
        .order('name');
      return data || [];
    },
    enabled: !!account?.id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      // Get unique warehouse locations from inventory
      const { data } = await supabase
        .from('wholesale_inventory')
        .select('warehouse_location')
        .eq('account_id', account.id);
      const locations = new Set((data || []).map((item: any) => item.warehouse_location).filter(Boolean));
      return Array.from(locations);
    },
    enabled: !!account?.id,
  });

  const createReceivingRecord = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate batch number
      const batchNumber = `BATCH-${Date.now()}`;

      const { error } = await supabase.from('inventory_batches').insert({
        account_id: account?.id,
        batch_number: batchNumber,
        product_id: data.product_id,
        quantity_lbs: parseFloat(data.quantity_lbs),
        cost_per_lb: parseFloat(data.cost_per_lb),
        warehouse_location: data.warehouse_location,
        received_date: new Date().toISOString(),
        expiration_date: data.expiration_date || null,
        status: 'active',
      });

      if (error) throw error;

      // Update inventory
      const { error: invError } = await supabase
        .from('wholesale_inventory')
        .upsert({
          account_id: account?.id,
          product_id: data.product_id,
          warehouse_location: data.warehouse_location,
          quantity_lbs: supabase.rpc('increment', {
            table_name: 'wholesale_inventory',
            id_column: 'id',
            increment_column: 'quantity_lbs',
            increment_value: parseFloat(data.quantity_lbs),
          }),
        });

      if (invError) throw invError;
    },
    onSuccess: () => {
      showSuccessToast('Inventory received successfully');
      setIsDialogOpen(false);
      setFormData({
        product_id: '',
        quantity_lbs: '',
        cost_per_lb: '',
        warehouse_location: '',
        expiration_date: '',
      });
      queryClient.invalidateQueries({ queryKey: ['receiving-records'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: () => {
      showErrorToast('Failed to receive inventory');
    },
  });

  const columns: ColumnDef<ReceivingRecord>[] = [
    {
      accessorKey: 'batch_number',
      header: 'Batch #',
      cell: ({ row }) => (
        <div className="font-mono font-medium">{row.original.batch_number}</div>
      ),
    },
    {
      accessorKey: 'products.name',
      header: 'Product',
      cell: ({ row }) => row.original.products?.name || 'N/A',
    },
    {
      accessorKey: 'quantity_lbs',
      header: 'Quantity',
      cell: ({ row }) => `${Number(row.original.quantity_lbs).toFixed(2)} lbs`,
    },
    {
      accessorKey: 'cost_per_lb',
      header: 'Cost/lb',
      cell: ({ row }) => `$${Number(row.original.cost_per_lb).toFixed(2)}`,
    },
    {
      accessorKey: 'warehouse_location',
      header: 'Location',
      cell: ({ row }) => (
        <Badge variant="outline">
          <Warehouse className="h-3 w-3 mr-1" />
          {row.original.warehouse_location}
        </Badge>
      ),
    },
    {
      accessorKey: 'received_date',
      header: 'Received',
      cell: ({ row }) => format(new Date(row.original.received_date), 'MMM d, yyyy HH:mm'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🏭 Receiving & Packaging</h1>
          <p className="text-muted-foreground">
            Receive inventory, create batches, and manage packaging operations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Receive Inventory
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Receive New Inventory</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product: any) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity (lbs)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.quantity_lbs}
                    onChange={(e) => setFormData({ ...formData, quantity_lbs: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Cost per lb ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cost_per_lb}
                    onChange={(e) => setFormData({ ...formData, cost_per_lb: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label>Warehouse Location</Label>
                <Select
                  value={formData.warehouse_location}
                  onValueChange={(value) =>
                    setFormData({ ...formData, warehouse_location: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses?.map((wh: string) => (
                      <SelectItem key={wh} value={wh}>
                        {wh}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">+ Add New Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiration Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createReceivingRecord.mutate(formData)}
                  disabled={createReceivingRecord.isPending}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Receive Inventory
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <DataTable
          columns={columns}
          data={receivingRecords || []}
          loading={isLoading}
          emptyMessage="No receiving records found. Receive your first shipment!"
        />
      </Card>
    </div>
  );
}

