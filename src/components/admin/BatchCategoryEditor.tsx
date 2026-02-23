/**
 * Batch Category Editor
 * Change category for multiple products at once
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Loader2, ArrowRight, Flower2, Cookie, Cloud, Diamond } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface BatchCategoryEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onApply: (newCategory: string) => Promise<void>;
}

const CATEGORIES = [
  { value: 'flower', label: 'Flower', icon: Flower2 },
  { value: 'edibles', label: 'Edibles', icon: Cookie },
  { value: 'vapes', label: 'Vapes', icon: Cloud },
  { value: 'concentrates', label: 'Concentrates', icon: Diamond },
];

export function BatchCategoryEditor({ open, onOpenChange, products, onApply }: BatchCategoryEditorProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Group products by current category
  const categoryCounts = products.reduce((acc, product) => {
    const category = product.category || 'uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleApply = async () => {
    if (!selectedCategory) return;
    
    setIsApplying(true);
    try {
      await onApply(selectedCategory);
      onOpenChange(false);
      setSelectedCategory('');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch Category Assignment</DialogTitle>
          <DialogDescription>
            Change category for {products.length} product{products.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Categories Summary */}
          <div className="space-y-2">
            <Label>Current Categories</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryCounts).map(([category, count]) => (
                <Badge key={category} variant="secondary" className="capitalize">
                  {category}: {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* New Category Selection */}
          <div className="space-y-2">
            <Label>New Category <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className="h-4 w-4" />
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {selectedCategory && (
            <div className="space-y-2">
              <Label>Preview Changes</Label>
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-medium">
                      {Object.keys(categoryCounts).length} categor{Object.keys(categoryCounts).length !== 1 ? 'ies' : 'y'}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-muted-foreground">New</p>
                    <p className="font-medium text-primary capitalize flex items-center gap-1">
                      {(() => { const cat = CATEGORIES.find(c => c.value === selectedCategory); return cat ? <cat.icon className="h-4 w-4" /> : null; })()}
                      {selectedCategory}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  All {products.length} products will be moved to {selectedCategory}
                </p>
              </div>
            </div>
          )}

          {/* Product List */}
          <div className="space-y-2">
            <Label>Products to Update</Label>
            <div className="border rounded-lg max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th scope="col" className="text-left p-2">Product</th>
                    <th scope="col" className="text-left p-2">Current Category</th>
                    <th scope="col" className="text-left p-2">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-t">
                      <td className="p-2">
                        <p className="font-medium truncate">{product.name}</p>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className="capitalize">
                          {product.category || 'none'}
                        </Badge>
                      </td>
                      <td className="p-2 text-muted-foreground">{product.sku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!selectedCategory || isApplying}>
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Update {products.length} Products
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
