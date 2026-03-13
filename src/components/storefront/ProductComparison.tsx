import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  thc_content?: number;
  cbd_content?: number;
  strain_type?: string;
  effects?: string[];
}

interface ProductComparisonProps {
  products: Product[];
  onRemoveProduct: (productId: string) => void;
  onAddToCart?: (productId: string) => void;
}

export function ProductComparison({ products, onRemoveProduct, onAddToCart }: ProductComparisonProps) {
  if (products.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Add products to compare them side by side</p>
      </Card>
    );
  }

  const rows = [
    { label: 'Image', key: 'image' },
    { label: 'Name', key: 'name' },
    { label: 'Price', key: 'price' },
    { label: 'Strain Type', key: 'strain_type' },
    { label: 'THC %', key: 'thc_content' },
    { label: 'CBD %', key: 'cbd_content' },
    { label: 'Effects', key: 'effects' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border p-3 bg-muted font-medium text-left">Feature</th>
            {products.map((product) => (
              <th key={product.id} className="border p-3 bg-muted relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1"
                  onClick={() => onRemoveProduct(product.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="border p-3 font-medium bg-muted/50">{row.label}</td>
              {products.map((product) => {
                const value = product[row.key as keyof Product];
                let display;

                if (row.key === 'image') {
                  display = product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-20 w-20 object-cover rounded" />
                  ) : (
                    <div className="h-20 w-20 bg-muted rounded" />
                  );
                } else if (row.key === 'price') {
                  display = formatCurrency(product.price);
                } else if (row.key === 'effects') {
                  display = Array.isArray(value) ? value.join(', ') : value || 'N/A';
                } else {
                  display = value || 'N/A';
                }

                return (
                  <td key={product.id} className="border p-3 text-center">
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
          {onAddToCart && (
            <tr>
              <td className="border p-3 bg-muted/50"></td>
              {products.map((product) => (
                <td key={product.id} className="border p-3 text-center">
                  <Button onClick={() => onAddToCart(product.id)} className="w-full">
                    Add to Cart
                  </Button>
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
