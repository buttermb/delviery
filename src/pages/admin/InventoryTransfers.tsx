import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Plus, CheckCircle, X, Truck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Transfer {
  id: string;
  transfer_number?: string;
  product_id?: string;
  product_name?: string;
  from_location?: string;
  from_location_id?: string;
  to_location?: string;
  to_location_id?: string;
  quantity?: number;
  quantity_lbs?: number;
  status: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
}

export default function InventoryTransfers() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    from_location: '',
    to_location: '',
    quantity: '',
    notes: '',
  });
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch locations
  const { data: locations } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      try {
        // Try multiple location table names
        const tables = ['locations', 'inventory_locations'];
        for (const table of tables) {
          try {
            const { data, error } = await supabase
              .from(table as any)
              .select('id, name, address')
              .eq('tenant_id', tenantId)
              .limit(100);

            if (!error && data) {
              return data.map((loc: any) => ({
                id: loc.id,
                name: loc.name || loc.address || 'Unknown Location',
              }));
            }
          } catch (e) {
            // Table doesn't exist, try next
          }
        }
        
        // Fallback: return warehouse locations from wholesale_inventory
        const { data: inventory } = await supabase
          .from('wholesale_inventory')
          .select('warehouse_location')
          .eq('tenant_id', tenantId)
          .limit(100);

        if (inventory) {
          const uniqueLocations = [...new Set(inventory.map((inv: any) => inv.warehouse_location))];
          return uniqueLocations.map((loc) => ({ id: loc, name: loc }));
        }

        return [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!tenantId,
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products-for-transfer', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Try products table
        const { data, error } = await supabase
          .from('products')
          .select('id, name, stock_quantity')
          .eq('tenant_id', tenantId)
          .limit(100);

        if (!error && data) {
          return data.map((p: any) => ({
            id: p.id,
            name: p.name,
            stock: p.stock_quantity || 0,
          }));
        }

        // Fallback: try wholesale_inventory
        const { data: wholesale, error: wholesaleError } = await supabase
          .from('wholesale_inventory')
          .select('id, strain, weight_lbs')
          .eq('tenant_id', tenantId)
          .limit(100);

        if (!wholesaleError && wholesale) {
          return wholesale.map((w: any) => ({
            id: w.id,
            name: w.strain || 'Unknown Product',
            stock: w.weight_lbs || 0,
          }));
        }

        return [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!tenantId,
  });

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['inventory-transfers', tenantId, filterStatus],
    queryFn: async (): Promise<Transfer[]> => {
      if (!tenantId) return [];

      const tables = ['inventory_transfers', 'inventory_transfers_enhanced', 'wholesale_inventory_transfers'];
      
      for (const table of tables) {
        try {
          let query = supabase.from(table as any).select('*').eq('tenant_id', tenantId);

          // Some tables use account_id instead of tenant_id
          if (table === 'inventory_transfers') {
            query = supabase.from(table as any).select('*');
            // Would need account_id mapping, skip for now
          }

          if (filterStatus !== 'all') {
            query = query.eq('status', filterStatus);
          }

          const { data, error } = await query.order('created_at', { ascending: false }).limit(100);

          if (!error && data) {
            return data.map((transfer: any) => ({
              id: transfer.id,
              transfer_number: transfer.transfer_number,
              product_id: transfer.product_id || transfer.inventory_id,
              from_location: transfer.from_location || transfer.from_warehouse,
              from_location_id: transfer.from_location_id,
              to_location: transfer.to_location || transfer.to_warehouse,
              to_location_id: transfer.to_location_id,
              quantity: transfer.quantity,
              quantity_lbs: transfer.quantity_lbs,
              status: transfer.status || 'pending',
              notes: transfer.notes,
              created_at: transfer.created_at,
              completed_at: transfer.completed_at,
            }));
          }
        } catch (error: any) {
          if (error.code !== '42P01') {
            console.warn(`Error fetching from ${table}:`, error);
          }
        }
      }

      return [];
    },
    enabled: !!tenantId,
  });

  const createTransferMutation = useMutation({
    mutationFn: async (transfer: {
      product_id: string;
      from_location: string;
      to_location: string;
      quantity: number;
      notes?: string;
    }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Try to create in inventory_transfers table
      try {
        const transferNumber = `TRF-${Date.now()}`;
        const { data, error } = await supabase
          .from('inventory_transfers')
          .insert({
            tenant_id: tenantId,
            product_id: transfer.product_id,
            from_location: transfer.from_location,
            to_location: transfer.to_location,
            quantity_lbs: transfer.quantity,
            status: 'pending',
            notes: transfer.notes || null,
            transfer_number: transferNumber,
          })
          .select()
          .single();

        if (error && error.code === '42P01') {
          throw new Error('Inventory transfers table does not exist. Please run database migrations.');
        }
        if (error) throw error;
        return data;
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          throw error;
        }
        // Try alternative table structure
        const { data, error: altError } = await supabase
          .from('wholesale_inventory_transfers')
          .insert({
            inventory_id: transfer.product_id,
            from_location: transfer.from_location,
            to_location: transfer.to_location,
            quantity_lbs: transfer.quantity,
            status: 'pending',
          })
          .select()
          .single();

        if (altError) throw altError;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers', tenantId] });
      toast({ title: 'Transfer created', description: 'Inventory transfer has been created successfully.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create transfer',
        variant: 'destructive',
      });
    },
  });

  const approveTransferMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_transfers')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error && error.code !== '42P01') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers', tenantId] });
      toast({ title: 'Transfer approved', description: 'Transfer has been approved.' });
    },
  });

  const completeTransferMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_transfers')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);

      if (error && error.code !== '42P01') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers', tenantId] });
      toast({ title: 'Transfer completed', description: 'Transfer has been marked as completed.' });
    },
  });

  const resetForm = () => {
    setFormData({
      product_id: '',
      from_location: '',
      to_location: '',
      quantity: '',
      notes: '',
    });
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTransferMutation.mutate({
      product_id: formData.product_id,
      from_location: formData.from_location,
      to_location: formData.to_location,
      quantity: Number(formData.quantity),
      notes: formData.notes || undefined,
    });
  };

  const pendingTransfers = transfers?.filter((t) => t.status === 'pending') || [];
  const inTransitTransfers = transfers?.filter((t) => t.status === 'in_transit' || t.status === 'in_progress') || [];
  const completedTransfers = transfers?.filter((t) => t.status === 'completed') || [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading transfers...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Inventory Transfers</h1>
          <p className="text-muted-foreground">Transfer stock between locations</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTransfers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inTransitTransfers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTransfers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Create Transfer Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product">Product</Label>
                  <Select
                    value={formData.product_id}
                    onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                    required
                  >
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (Stock: {product.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="from">From Location</Label>
                  <Select
                    value={formData.from_location}
                    onValueChange={(value) => setFormData({ ...formData, from_location: value })}
                    required
                  >
                    <SelectTrigger id="from">
                      <SelectValue placeholder="Select source location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="to">To Location</Label>
                  <Select
                    value={formData.to_location}
                    onValueChange={(value) => setFormData({ ...formData, to_location: value })}
                    required
                  >
                    <SelectTrigger id="to">
                      <SelectValue placeholder="Select destination location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes about this transfer"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createTransferMutation.isPending}>
                  Create Transfer
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History ({transfers?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {transfers && transfers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-mono text-xs">
                      {transfer.transfer_number || transfer.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{transfer.product_name || 'N/A'}</TableCell>
                    <TableCell>{transfer.from_location || '—'}</TableCell>
                    <TableCell>{transfer.to_location || '—'}</TableCell>
                    <TableCell>
                      {transfer.quantity_lbs ? `${transfer.quantity_lbs} lbs` : transfer.quantity || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transfer.status === 'completed'
                            ? 'default'
                            : transfer.status === 'pending'
                            ? 'outline'
                            : 'secondary'
                        }
                      >
                        {transfer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(transfer.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {transfer.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveTransferMutation.mutate(transfer.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                        )}
                        {(transfer.status === 'approved' || transfer.status === 'in_transit') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completeTransferMutation.mutate(transfer.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {transfers !== undefined
                ? 'No transfers found. Create a new transfer to get started.'
                : 'Inventory transfers table not found. Please run database migrations.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

