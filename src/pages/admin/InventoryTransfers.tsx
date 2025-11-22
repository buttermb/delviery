import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Truck, Plus, Package } from 'lucide-react';

export default function InventoryTransfers() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    from_warehouse: '',
    to_warehouse: '',
    quantity_lbs: '',
    notes: '',
  });

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['inventory-transfers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('inventory_transfers' as any)
          .select('*, product:wholesale_inventory(*)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createTransferMutation = useMutation({
    mutationFn: async (transfer: any) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('inventory_transfers' as any)
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
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers', tenantId] });
      toast({ title: 'Transfer created', description: 'Inventory transfer has been created.' });
      setFormData({
        product_id: '',
        from_warehouse: '',
        to_warehouse: '',
        quantity_lbs: '',
        notes: '',
      });
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create transfer',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTransferMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading transfers...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Transfers</h1>
          <p className="text-muted-foreground">Manage inventory transfers between locations</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {transfers && transfers.length > 0 ? (
        <div className="space-y-4">
          {transfers.map((transfer: any) => (
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
                      {new Date(transfer.created_at).toLocaleDateString()}
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
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No inventory transfers found. Create your first transfer to get started.</p>
            </div>
          </CardContent>
        </Card>
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
                <Label htmlFor="from_warehouse">From Warehouse</Label>
                <Input
                  id="from_warehouse"
                  value={formData.from_warehouse}
                  onChange={(e) => setFormData({ ...formData, from_warehouse: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to_warehouse">To Warehouse</Label>
                <Input
                  id="to_warehouse"
                  value={formData.to_warehouse}
                  onChange={(e) => setFormData({ ...formData, to_warehouse: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_lbs">Quantity (lbs)</Label>
                <Input
                  id="quantity_lbs"
                  type="number"
                  step="0.01"
                  value={formData.quantity_lbs}
                  onChange={(e) => setFormData({ ...formData, quantity_lbs: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
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
                Create Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

