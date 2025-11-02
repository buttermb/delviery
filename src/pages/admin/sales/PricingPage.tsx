// @ts-nocheck
/**
 * Pricing & Deals Page
 * Manage pricing tiers, bulk discounts, and special deals
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, DollarSign, Tag, TrendingDown, Edit, Trash2 } from 'lucide-react';
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

interface PricingTier {
  id: string;
  product_id: string;
  min_quantity: number;
  price_per_lb: number;
  bulk_discount_percent?: number;
  products?: {
    name: string;
  };
}

export default function PricingPage() {
  const { account } = useAccount();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [formData, setFormData] = useState({
    product_id: '',
    min_quantity: '',
    price_per_lb: '',
    bulk_discount_percent: '',
  });

  const { data: pricingTiers, isLoading } = useQuery({
    queryKey: ['pricing-tiers', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          wholesale_price,
          cost_per_unit,
          bulk_discount
        `)
        .eq('account_id', account.id)
        .order('name');

      if (error) throw error;

      // Transform to pricing tiers format
      return (data || []).map((product: any) => ({
        id: product.id,
        product_id: product.id,
        min_quantity: 1,
        price_per_lb: product.wholesale_price || 0,
        bulk_discount_percent: product.bulk_discount || 0,
        products: { name: product.name },
      }));
    },
    enabled: !!account?.id,
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-pricing', account?.id],
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

  const columns: ColumnDef<PricingTier>[] = [
    {
      accessorKey: 'products.name',
      header: 'Product',
      cell: ({ original }) => original.products?.name || 'N/A',
    },
    {
      accessorKey: 'min_quantity',
      header: 'Min Quantity',
      cell: ({ original }) => `${original.min_quantity} lbs`,
    },
    {
      accessorKey: 'price_per_lb',
      header: 'Price/lb',
      cell: ({ original }) => (
        <div className="font-medium">
          ${Number(original.price_per_lb).toFixed(2)}
        </div>
      ),
    },
    {
      accessorKey: 'bulk_discount_percent',
      header: 'Discount',
      cell: ({ original }) => {
        const discount = original.bulk_discount_percent || 0;
        return discount > 0 ? (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
            <TrendingDown className="h-3 w-3 mr-1" />
            {discount}%
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
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
              setEditingTier(original);
              setFormData({
                product_id: original.product_id,
                min_quantity: String(original.min_quantity),
                price_per_lb: String(original.price_per_lb),
                bulk_discount_percent: String(original.bulk_discount_percent || 0),
              });
              setIsDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleSave = async () => {
    try {
      const updateData = {
        wholesale_price: parseFloat(formData.price_per_lb),
        bulk_discount: parseFloat(formData.bulk_discount_percent) || 0,
      };

      const { error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', formData.product_id)
        .eq('account_id', account?.id);

      if (error) throw error;

      showSuccessToast('Pricing updated successfully');
      setIsDialogOpen(false);
      setEditingTier(null);
      setFormData({
        product_id: '',
        min_quantity: '',
        price_per_lb: '',
        bulk_discount_percent: '',
      });
      queryClient.invalidateQueries({ queryKey: ['pricing-tiers'] });
    } catch (error) {
      showErrorToast('Failed to update pricing');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">💰 Pricing & Deals</h1>
          <p className="text-muted-foreground">
            Manage pricing tiers, bulk discounts, and special deals for your products
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Set Pricing
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTier ? 'Edit Pricing' : 'Set Product Pricing'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                  disabled={!!editingTier}
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
              <div>
                <Label>Wholesale Price per lb ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price_per_lb}
                  onChange={(e) => setFormData({ ...formData, price_per_lb: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Bulk Discount (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.bulk_discount_percent}
                  onChange={(e) =>
                    setFormData({ ...formData, bulk_discount_percent: e.target.value })
                  }
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Percentage discount for bulk orders
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Save Pricing
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <DataTable
          columns={columns}
          data={pricingTiers || []}
          loading={isLoading}
          emptyMessage="No pricing tiers configured. Set pricing for your products!"
        />
      </Card>

      {/* Pricing Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Products with Pricing</div>
          <div className="text-2xl font-bold">{pricingTiers?.length || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Products with Discounts</div>
          <div className="text-2xl font-bold">
            {pricingTiers?.filter((t) => (t.bulk_discount_percent || 0) > 0).length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Avg Price/lb</div>
          <div className="text-2xl font-bold">
            $
            {pricingTiers && pricingTiers.length > 0
              ? (
                  pricingTiers.reduce((sum, t) => sum + Number(t.price_per_lb || 0), 0) /
                  pricingTiers.length
                ).toFixed(2)
              : '0.00'}
          </div>
        </Card>
      </div>
    </div>
  );
}

