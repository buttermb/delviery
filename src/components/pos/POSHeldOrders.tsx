/**
 * POS Held Orders Component
 * Allows parking/holding current cart and recalling it later
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Trash2, ShoppingCart, Pause } from 'lucide-react';
import { formatSmartDate, formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface HeldOrder {
  id: string;
  name: string;
  items: CartItem[];
  subtotal: number;
  createdAt: string;
}

interface POSHeldOrdersProps {
  currentCart: CartItem[];
  onRecall: (items: CartItem[]) => void;
  onClearCart: () => void;
}

export function POSHeldOrders({ currentCart, onRecall, onClearCart }: POSHeldOrdersProps) {
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [parkDialogOpen, setParkDialogOpen] = useState(false);
  const [orderName, setOrderName] = useState('');

  const handleParkOrder = () => {
    if (currentCart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const name = orderName.trim() || `Order ${heldOrders.length + 1}`;
    const subtotal = currentCart.reduce((sum, item) => sum + item.subtotal, 0);

    const heldOrder: HeldOrder = {
      id: `held-${Date.now()}`,
      name,
      items: [...currentCart],
      subtotal,
      createdAt: new Date().toISOString(),
    };

    setHeldOrders([...heldOrders, heldOrder]);
    onClearCart();
    setParkDialogOpen(false);
    setOrderName('');
    toast.success(`Order "${name}" parked`);
  };

  const handleRecallOrder = (heldOrder: HeldOrder) => {
    onRecall(heldOrder.items);
    setHeldOrders(heldOrders.filter((o) => o.id !== heldOrder.id));
    toast.success(`Order "${heldOrder.name}" recalled`);
  };

  const handleDeleteHeldOrder = (id: string) => {
    const order = heldOrders.find((o) => o.id === id);
    setHeldOrders(heldOrders.filter((o) => o.id !== id));
    if (order) {
      toast.success(`Order "${order.name}" deleted`);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Held Orders
              </CardTitle>
              <CardDescription className="text-xs">Park and recall orders</CardDescription>
            </div>
            <Badge variant="secondary">{heldOrders.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setParkDialogOpen(true)}
            disabled={currentCart.length === 0}
            className="w-full"
          >
            <Pause className="h-4 w-4 mr-2" />
            Park Current Order
          </Button>

          {heldOrders.length > 0 ? (
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {heldOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{order.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''} •{' '}
                          {formatSmartDate(order.createdAt, { includeTime: true })}
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          {formatCurrency(order.subtotal)}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRecallOrder(order)}
                          className="h-8 w-8"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteHeldOrder(order.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No held orders
            </div>
          )}
        </CardContent>
      </Card>

      {/* Park Order Dialog */}
      <Dialog open={parkDialogOpen} onOpenChange={setParkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Park Order</DialogTitle>
            <DialogDescription>
              Give this order a name to recall it later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="order-name">Order Name (Optional)</Label>
              <Input
                id="order-name"
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                placeholder="e.g., Table 5, John's order..."
                maxLength={50}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {currentCart.length} item{currentCart.length !== 1 ? 's' : ''} •{' '}
              {formatCurrency(currentCart.reduce((sum, item) => sum + item.subtotal, 0))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleParkOrder}>Park Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
