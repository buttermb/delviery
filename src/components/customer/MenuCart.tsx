import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Trash2, Plus, Minus, AlertCircle } from 'lucide-react';
import { cleanProductName } from '@/utils/productName';
import { cn } from '@/lib/utils';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  min_quantity: number;
  max_quantity: number;
}

interface MenuCartProps {
  items: CartItem[];
  minOrderTotal?: number;
  maxOrderTotal?: number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
  className?: string;
}

export const MenuCart = ({
  items,
  minOrderTotal = 0,
  maxOrderTotal = 999999,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  className
}: MenuCartProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const canCheckout = totalQuantity >= minOrderTotal && totalQuantity <= maxOrderTotal && items.length > 0;

  if (items.length === 0) return null;

  return (
    <div className={cn("fixed bottom-0 left-0 right-0 z-50", className)}>
      <Card className="rounded-t-2xl rounded-b-none border-t shadow-2xl">
        {/* Cart Summary (Always Visible) */}
        <div 
          className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="h-6 w-6" />
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {items.length}
                </Badge>
              </div>
              <div>
                <p className="font-semibold">Your Order</p>
                <p className="text-sm text-muted-foreground">
                  {totalQuantity} lbs - ${totalAmount.toLocaleString()}
                </p>
              </div>
            </div>
            <Button onClick={(e) => { e.stopPropagation(); onCheckout(); }} disabled={!canCheckout}>
              Review Order
            </Button>
          </div>

          {/* Min/Max Order Warning */}
          {!canCheckout && items.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              {totalQuantity < minOrderTotal && (
                <span>Minimum order: {minOrderTotal} lbs (need {minOrderTotal - totalQuantity} more)</span>
              )}
              {totalQuantity > maxOrderTotal && (
                <span>Maximum order: {maxOrderTotal} lbs (reduce by {totalQuantity - maxOrderTotal})</span>
              )}
            </div>
          )}
        </div>

        {/* Expanded Cart Items */}
        {isExpanded && (
          <div className="border-t max-h-96 overflow-y-auto">
            <div className="p-4 space-y-3">
              {items.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                  <div className="flex-1">
                    <p className="font-medium">{cleanProductName(item.name)}</p>
                    <p className="text-sm text-muted-foreground">
                      ${item.price}/lb × {item.quantity} = ${(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                      disabled={item.quantity <= item.min_quantity}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-12 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                      disabled={item.quantity >= item.max_quantity}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Remove Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onRemoveItem(item.product_id)}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
