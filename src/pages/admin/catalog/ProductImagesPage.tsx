/**
 * Product Images & Media Page
 * Dedicated page for managing product images with upload, optimization, and organization
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Upload, Image as ImageIcon, Search, Download, Trash2, Edit } from 'lucide-react';
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

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
  products?: {
    name: string;
  };
}

export default function ProductImagesPage() {
  const { account } = useAccount();
  const [search, setSearch] = useState('');

  const { data: images, isLoading } = useQuery({
    queryKey: ['product-images', account?.id, search],
    queryFn: async () => {
      if (!account?.id) return [];

      // For now, get products and show placeholder structure
      // When product_images table exists, use the query below
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .eq('account_id', account.id)
        .limit(20);

      // Filter by search if provided
      let filteredProducts = products || [];
      if (search) {
        filteredProducts = filteredProducts.filter((p: any) =>
          p.name.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Return mock structure for now
      return filteredProducts.map((product: any) => ({
        id: `img-${product.id}`,
        product_id: product.id,
        image_url: '/placeholder-image.png',
        display_order: 1,
        is_primary: true,
        created_at: new Date().toISOString(),
        products: { name: product.name },
      }));
    },
    enabled: !!account?.id,
  });

  const columns: ColumnDef<ProductImage>[] = [
    {
      accessorKey: 'image_url',
      header: 'Image',
      cell: ({ original }) => (
        <div className="flex items-center gap-3">
          <img
            src={original.image_url}
            alt="Product"
            className="h-12 w-12 rounded object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-image.png';
            }}
          />
        </div>
      ),
    },
    {
      accessorKey: 'products.name',
      header: 'Product',
      cell: ({ original }) => original.products?.name || 'N/A',
    },
    {
      accessorKey: 'display_order',
      header: 'Order',
      cell: ({ original }) => original.display_order || 0,
    },
    {
      accessorKey: 'is_primary',
      header: 'Status',
      cell: ({ original }) => (
        <Badge variant={original.is_primary ? 'default' : 'secondary'}>
          {original.is_primary ? 'Primary' : 'Secondary'}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Uploaded',
      cell: ({ original }) => format(new Date(original.created_at), 'MMM d, yyyy'),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ original }) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">📸 Images & Media</h1>
          <p className="text-muted-foreground">
            Manage product images, upload new media, and organize your catalog visuals
          </p>
        </div>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Images
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={images || []}
          loading={isLoading}
          searchable={false}
          emptyMessage="No images found. Upload your first product image!"
        />
      </Card>
    </div>
  );
}

