/**
 * Batches & Lots Page
 * Track and manage inventory batches with full chain of custody
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, Package, Search, Eye, Barcode } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
import { useNavigate } from 'react-router-dom';

interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  quantity_lbs: number;
  cost_per_lb: number;
  received_date: string;
  expiration_date?: string;
  status: string;
  warehouse_location?: string;
  products?: {
    name: string;
  };
}

export default function BatchesPage() {
  const { account } = useAccount();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches', account?.id, search],
    queryFn: async () => {
      if (!account?.id) return [];

      let query = supabase
        .from('inventory_batches')
        .select(`
          id,
          batch_number,
          product_id,
          quantity_lbs,
          cost_per_lb,
          received_date,
          expiration_date,
          status,
          warehouse_location,
          products:products!inner(
            name
          )
        `)
        .eq('account_id', account.id);

      if (search) {
        query = query.or(`batch_number.ilike.%${search}%,products.name.ilike.%${search}%`);
      }

      const { data, error } = await query.order('received_date', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Batch[];
    },
    enabled: !!account?.id,
  });

  const columns: ColumnDef<Batch>[] = [
    {
      accessorKey: 'batch_number',
      header: 'Batch Number',
      cell: ({ original }) => (
        <div className="font-mono font-medium">{original.batch_number}</div>
      ),
    },
    {
      accessorKey: 'products.name',
      header: 'Product',
      cell: ({ original }) => original.products?.name || 'N/A',
    },
    {
      accessorKey: 'quantity_lbs',
      header: 'Quantity',
      cell: ({ original }) => `${Number(original.quantity_lbs).toFixed(2)} lbs`,
    },
    {
      accessorKey: 'cost_per_lb',
      header: 'Cost/lb',
      cell: ({ original }) => `$${Number(original.cost_per_lb).toFixed(2)}`,
    },
    {
      accessorKey: 'warehouse_location',
      header: 'Location',
      cell: ({ original }) => original.warehouse_location || 'Unknown',
    },
    {
      accessorKey: 'received_date',
      header: 'Received',
      cell: ({ original }) => format(new Date(original.received_date), 'MMM d, yyyy'),
    },
    {
      accessorKey: 'expiration_date',
      header: 'Expires',
      cell: ({ original }) =>
        original.expiration_date
          ? format(new Date(original.expiration_date), 'MMM d, yyyy')
          : 'N/A',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ original }) => <StatusBadge status={original.status} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ original }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/inventory/products?batch=${original.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Barcode className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🎯 Batches & Lots</h1>
          <p className="text-muted-foreground">
            Track inventory batches, expiration dates, and maintain chain of custody
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Batch
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search batches or products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={batches || []}
          loading={isLoading}
          searchable={false}
          emptyMessage="No batches found. Create your first batch!"
        />
      </Card>

      {/* Batch Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Batches</div>
          <div className="text-2xl font-bold">{batches?.length || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Quantity</div>
          <div className="text-2xl font-bold">
            {batches?.reduce((sum, b) => sum + Number(b.quantity_lbs || 0), 0).toFixed(1) || 0} lbs
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Active Batches</div>
          <div className="text-2xl font-bold">
            {batches?.filter((b) => b.status === 'active').length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Expiring Soon</div>
          <div className="text-2xl font-bold">
            {batches?.filter((b) => {
              if (!b.expiration_date) return false;
              const expDate = new Date(b.expiration_date);
              const daysUntilExp = (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
              return daysUntilExp <= 30 && daysUntilExp > 0;
            }).length || 0}
          </div>
        </Card>
      </div>
    </div>
  );
}

