import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { PackageCheck, Plus, X, Loader2 } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface ReceivingItem {
  product_id: string;
  product_name: string;
  quantity_lbs: number;
}

export function QuickReceiving() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');

  const { data: products } = useQuery({
    queryKey: ['wholesale-inventory', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('wholesale_inventory')
        .select('id, product_name')
        .eq('tenant_id', tenant.id)
        .order('product_name');

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const addItem = () => {
    if (!selectedProduct || !quantity || parseFloat(quantity) <= 0) {
      toast.error('Please select a product and enter a valid quantity');
      return;
    }

    const product = products?.find((p) => p.id === selectedProduct);
    if (!product) return;

    setItems([
      ...items,
      {
        product_id: selectedProduct,
        product_name: product.product_name,
        quantity_lbs: parseFloat(quantity),
      },
    ]);

    setSelectedProduct('');
    setQuantity('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (items.length === 0) {
        throw new Error('No items to receive');
      }

      // Update inventory for each item
      for (const item of items) {
        if (!tenant?.id) throw new Error("Tenant ID required");
        
        const { data: currentInventory, error: fetchError } = await supabase
          .from('wholesale_inventory')
          .select('quantity_lbs')
          .eq('id', item.product_id)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        const newQuantity = (currentInventory.quantity_lbs || 0) + item.quantity_lbs;

        const { error: updateError } = await supabase
          .from('wholesale_inventory')
          .update({
            quantity_lbs: newQuantity,
            last_restock_date: new Date().toISOString(),
          })
          .eq('id', item.product_id)
          .eq('tenant_id', tenant.id);

        if (updateError) throw updateError;

        // Log movement
        await supabase.from('wholesale_inventory_movements').insert({
          inventory_id: item.product_id,
          product_name: item.product_name,
          movement_type: 'receiving',
          quantity_change: item.quantity_lbs,
          notes: 'Quick receiving',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      toast.success(`Successfully received ${items.length} items`);
      setItems([]);
    },
    onError: (error: unknown) => {
      logger.error('Failed to receive items', error, { component: 'QuickReceiving' });
      toast.error(`Failed to receive items: ${error instanceof Error ? error.message : 'An error occurred'}`);
    },
  });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <PackageCheck className="h-6 w-6 text-primary" />
        <h3 className="text-xl font-semibold">Quick Receiving</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <div className="space-y-2">
          <Label>Product</Label>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger>
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {products?.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.product_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Quantity (lbs)</Label>
          <Input
            type="number"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
          />
        </div>

        <div className="flex items-end">
          <Button onClick={addItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-4">
          <div className="border rounded-lg divide-y">
            {items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity_lbs} lbs
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={() => {
              try {
                receiveMutation.mutate();
              } catch (error) {
                logger.error('Button click error', error, { component: 'QuickReceiving' });
              }
            }}
            disabled={items.length === 0 || receiveMutation.isPending}
            className="w-full"
            size="lg"
          >
            {receiveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Receive ${items.length} Items`
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
