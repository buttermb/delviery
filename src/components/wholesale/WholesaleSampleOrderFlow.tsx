import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TestTube } from 'lucide-react';
import { toast } from 'sonner';

interface SampleProduct {
  id: string;
  name: string;
  category: string;
}

interface WholesaleSampleOrderFlowProps {
  availableProducts: SampleProduct[];
  onCreateSampleOrder: (productIds: string[]) => void;
}

export function WholesaleSampleOrderFlow({
  availableProducts,
  onCreateSampleOrder,
}: WholesaleSampleOrderFlowProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const handleToggle = (productId: string) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      if (newSet.size >= 5) {
        toast.error('Maximum 5 samples per order');
        return;
      }
      newSet.add(productId);
    }
    setSelectedProducts(newSet);
  };

  const handleSubmit = () => {
    if (selectedProducts.size === 0) {
      toast.error('Select at least one product');
      return;
    }
    onCreateSampleOrder(Array.from(selectedProducts));
    toast.success('Sample order created');
    setSelectedProducts(new Set());
  };

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <TestTube className="h-4 w-4" />
        Sample Order (Max 5 items)
      </h4>
      <div className="space-y-3">
        {availableProducts.map((product) => (
          <div key={product.id} className="flex items-center gap-3">
            <Checkbox
              id={product.id}
              checked={selectedProducts.has(product.id)}
              onCheckedChange={() => handleToggle(product.id)}
            />
            <Label htmlFor={product.id} className="flex-1 cursor-pointer">
              {product.name}
            </Label>
            <Badge variant="secondary">{product.category}</Badge>
          </div>
        ))}
      </div>
      <Button onClick={handleSubmit} className="w-full mt-4" disabled={selectedProducts.size === 0}>
        Create Sample Order ({selectedProducts.size}/5)
      </Button>
    </Card>
  );
}
