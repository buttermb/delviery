/**
 * Bulk Price Editor
 * Edit prices for multiple products at once
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SafeModal, useFormDirtyState } from '@/components/ui/safe-modal';
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DollarSign, Percent, TrendingUp, TrendingDown } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface BulkPriceEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onApply: (updates: PriceUpdate[]) => Promise<void>;
}

export interface PriceUpdate {
  id: string;
  name: string;
  oldWholesale: number;
  newWholesale: number;
  oldRetail?: number;
  newRetail?: number;
}

type AdjustmentType = 'percentage_increase' | 'percentage_decrease' | 'fixed_increase' | 'fixed_decrease';
type PriceField = 'wholesale' | 'retail' | 'both';

const INITIAL_STATE = {
  adjustmentType: 'percentage_increase' as AdjustmentType,
  adjustmentValue: '',
  priceField: 'wholesale' as PriceField,
};

export function BulkPriceEditor({ open, onOpenChange, products, onApply }: BulkPriceEditorProps) {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>(INITIAL_STATE.adjustmentType);
  const [adjustmentValue, setAdjustmentValue] = useState(INITIAL_STATE.adjustmentValue);
  const [priceField, setPriceField] = useState<PriceField>(INITIAL_STATE.priceField);
  const [isApplying, setIsApplying] = useState(false);

  // Track if form has changes
  const isDirty = useFormDirtyState(INITIAL_STATE, {
    adjustmentType,
    adjustmentValue,
    priceField,
  });

  const calculateNewPrice = (oldPrice: number | null): number => {
    if (!oldPrice || !adjustmentValue) return oldPrice || 0;
    
    const value = parseFloat(adjustmentValue);
    if (isNaN(value)) return oldPrice;

    switch (adjustmentType) {
      case 'percentage_increase':
        return oldPrice * (1 + value / 100);
      case 'percentage_decrease':
        return oldPrice * (1 - value / 100);
      case 'fixed_increase':
        return oldPrice + value;
      case 'fixed_decrease':
        return Math.max(0, oldPrice - value);
      default:
        return oldPrice;
    }
  };

  const previewUpdates = (): PriceUpdate[] => {
    return products.map(product => {
      const update: PriceUpdate = {
        id: product.id,
        name: product.name || 'Unnamed Product',
        oldWholesale: product.wholesale_price || 0,
        newWholesale: product.wholesale_price || 0,
      };

      if (priceField === 'wholesale' || priceField === 'both') {
        update.newWholesale = calculateNewPrice(product.wholesale_price);
      }

      if (priceField === 'retail' || priceField === 'both') {
        update.oldRetail = product.retail_price || 0;
        update.newRetail = calculateNewPrice(product.retail_price);
      }

      return update;
    });
  };

  const handleApply = async () => {
    if (!adjustmentValue) return;
    
    setIsApplying(true);
    try {
      const updates = previewUpdates();
      await onApply(updates);
      onOpenChange(false);
      setAdjustmentValue('');
    } finally {
      setIsApplying(false);
    }
  };

  const updates = previewUpdates();
  const isValid = adjustmentValue && !isNaN(parseFloat(adjustmentValue));

  return (
    <SafeModal
      open={open}
      onOpenChange={onOpenChange}
      isDirty={isDirty}
      title="Bulk Price Editor"
      description={`Adjust prices for ${products.length} product${products.length !== 1 ? 's' : ''}`}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-6 py-4">
        {/* Price Field Selection */}
        <div className="space-y-2">
          <Label>Price Type</Label>
          <Select value={priceField} onValueChange={(v) => setPriceField(v as PriceField)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wholesale">Wholesale Price Only</SelectItem>
              <SelectItem value="retail">Retail Price Only</SelectItem>
              <SelectItem value="both">Both Prices</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Adjustment Type */}
        <div className="space-y-2">
          <Label>Adjustment Type</Label>
          <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage_increase">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Percentage Increase
                </div>
              </SelectItem>
              <SelectItem value="percentage_decrease">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Percentage Decrease
                </div>
              </SelectItem>
              <SelectItem value="fixed_increase">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Fixed Amount Increase
                </div>
              </SelectItem>
              <SelectItem value="fixed_decrease">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-red-500" />
                  Fixed Amount Decrease
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Adjustment Value */}
        <div className="space-y-2">
          <Label>
            {adjustmentType.includes('percentage') ? 'Percentage' : 'Amount'}
          </Label>
          <div className="relative">
            {adjustmentType.includes('percentage') ? (
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            ) : (
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input
              type="number"
              step="0.01"
              min="0"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
              placeholder={adjustmentType.includes('percentage') ? '10' : '5.00'}
              className="pl-9"
            />
          </div>
        </div>

        {/* Preview */}
        {isValid && (
          <div className="space-y-2">
            <Label>Preview Changes</Label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th scope="col" className="text-left p-2">Product</th>
                    {(priceField === 'wholesale' || priceField === 'both') && (
                      <th scope="col" className="text-right p-2">Wholesale</th>
                    )}
                    {(priceField === 'retail' || priceField === 'both') && (
                      <th scope="col" className="text-right p-2">Retail</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {updates.map((update) => (
                    <tr key={update.id} className="border-t">
                      <td className="p-2">
                        <p className="font-medium truncate">{update.name}</p>
                      </td>
                      {(priceField === 'wholesale' || priceField === 'both') && (
                        <td className="p-2 text-right">
                          <div className="space-y-1">
                            <p className="text-muted-foreground line-through">
                              ${update.oldWholesale.toFixed(2)}
                            </p>
                            <p className="font-medium text-primary">
                              ${update.newWholesale.toFixed(2)}
                            </p>
                          </div>
                        </td>
                      )}
                      {(priceField === 'retail' || priceField === 'both') && update.oldRetail !== undefined && (
                        <td className="p-2 text-right">
                          <div className="space-y-1">
                            <p className="text-muted-foreground line-through">
                              ${update.oldRetail.toFixed(2)}
                            </p>
                            <p className="font-medium text-primary">
                              ${(update.newRetail || 0).toFixed(2)}
                            </p>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <DialogFooterActions
        primaryLabel={isApplying ? 'Applying...' : `Apply to ${products.length} Products`}
        onPrimary={handleApply}
        primaryDisabled={!isValid}
        primaryLoading={isApplying}
        secondaryLabel="Cancel"
        onSecondary={() => onOpenChange(false)}
        secondaryDisabled={isApplying}
      />
    </SafeModal>
  );
}
