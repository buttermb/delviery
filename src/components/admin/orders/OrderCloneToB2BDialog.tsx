/**
 * OrderCloneToB2BDialog - Clone a retail order to a B2B/wholesale order
 * Allows selecting a wholesale client and adjusts pricing for B2B
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Package from "lucide-react/dist/esm/icons/package";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Search from "lucide-react/dist/esm/icons/search";
import { useWholesaleClients } from '@/hooks/useWholesaleData';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';

interface OrderItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  price: number;
}

interface RetailOrder {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  user?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  order_items?: OrderItem[];
}

interface WholesaleClient {
  id: string;
  business_name: string;
  contact_name: string;
  credit_limit: number;
  outstanding_balance: number;
  status: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface OrderCloneToB2BDialogProps {
  order: RetailOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OrderCloneToB2BDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: OrderCloneToB2BDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const { data: clients = [], isLoading: clientsLoading } = useWholesaleClients();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClient, setSelectedClient] = useState<WholesaleClient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceAdjustment, setPriceAdjustment] = useState<'keep' | 'wholesale' | 'custom'>('wholesale');
  const [customDiscount, setCustomDiscount] = useState(10);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client: WholesaleClient) =>
        client.business_name?.toLowerCase().includes(query) ||
        client.contact_name?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  // Calculate new order totals based on price adjustment
  const orderItems = useMemo(() => {
    if (!order?.order_items) return [];

    return order.order_items.map((item) => {
      let adjustedPrice = item.price;

      if (priceAdjustment === 'wholesale') {
        // Apply default 15% wholesale discount
        adjustedPrice = item.price * 0.85;
      } else if (priceAdjustment === 'custom') {
        adjustedPrice = item.price * (1 - customDiscount / 100);
      }

      return {
        ...item,
        original_price: item.price,
        adjusted_price: adjustedPrice,
        line_total: item.quantity * adjustedPrice,
      };
    });
  }, [order?.order_items, priceAdjustment, customDiscount]);

  const newTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.line_total, 0);
  }, [orderItems]);

  // Credit impact calculation
  const creditImpact = useMemo(() => {
    if (!selectedClient) return null;

    const newBalance = selectedClient.outstanding_balance + newTotal;
    const available = selectedClient.credit_limit - newBalance;
    const overLimit = newBalance > selectedClient.credit_limit;

    return {
      currentBalance: selectedClient.outstanding_balance,
      newBalance,
      available,
      overLimit,
      overLimitAmount: overLimit ? newBalance - selectedClient.credit_limit : 0,
    };
  }, [selectedClient, newTotal]);

  // Handle client selection
  const handleClientSelect = (client: WholesaleClient) => {
    setSelectedClient(client);
    setDeliveryAddress(client.address || '');
  };

  // Handle submission
  const handleSubmit = async () => {
    if (!order || !selectedClient || !tenant?.id) {
      toast.error('Missing required information');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('No items to clone');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create wholesale order via edge function
      const { data, error } = await supabase.functions.invoke('wholesale-order-create', {
        body: {
          client_id: selectedClient.id,
          items: orderItems.map((item) => ({
            product_name: item.product_name || `Product ${item.product_id}`,
            quantity: item.quantity,
            unit_price: Number(item.adjusted_price.toFixed(2)),
          })),
          payment_method: 'credit',
          delivery_address: deliveryAddress || selectedClient.address || 'No address provided',
          delivery_notes: `Cloned from retail order #${order.order_number}`,
          source_order_id: order.id,
          source_order_type: 'retail',
        },
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create wholesale order');
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
      queryClient.invalidateQueries({ queryKey: ['wholesale-clients'] });

      toast.success('B2B Order Created', {
        description: `Order #${data.order_number} created for ${selectedClient.business_name}`,
        action: {
          label: 'View Order',
          onClick: () => navigate('wholesale-orders'),
        },
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create B2B order';
      logger.error('Clone to B2B error', error instanceof Error ? error : new Error(message), {
        component: 'OrderCloneToB2BDialog',
        orderId: order.id,
        clientId: selectedClient.id,
      });
      toast.error('Clone Failed', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedClient(null);
      setSearchQuery('');
      setPriceAdjustment('wholesale');
      setCustomDiscount(10);
      setDeliveryAddress('');
    }
    onOpenChange(open);
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Clone to B2B Order
          </DialogTitle>
          <DialogDescription>
            Create a wholesale order from retail order #{order.order_number}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            {/* Original Order Summary */}
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Original Order</span>
                <Badge variant="outline">Retail</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Order #</span>
                  <p className="font-mono font-medium">{order.order_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer</span>
                  <p className="font-medium">
                    {order.user?.full_name || order.user?.email || 'Unknown'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Items</span>
                  <p className="font-medium">{order.order_items?.length || 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Original Total</span>
                  <p className="font-mono font-medium">{formatCurrency(order.total_amount)}</p>
                </div>
              </div>
            </Card>

            {/* Client Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Select Wholesale Client *
              </Label>

              {selectedClient ? (
                <Card className="p-4 border-emerald-500/50 bg-emerald-500/5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{selectedClient.business_name}</span>
                        <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Selected
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedClient.contact_name}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedClient(null)}>
                      Change
                    </Button>
                  </div>

                  {creditImpact && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t text-sm">
                      <div>
                        <span className="text-muted-foreground">Credit Limit</span>
                        <p className="font-mono font-semibold">
                          {formatCurrency(selectedClient.credit_limit)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current Balance</span>
                        <p className={cn(
                          'font-mono font-semibold',
                          creditImpact.currentBalance > 0 ? 'text-red-500' : ''
                        )}>
                          {formatCurrency(creditImpact.currentBalance)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">After Order</span>
                        <p className={cn(
                          'font-mono font-semibold',
                          creditImpact.overLimit ? 'text-red-500' : 'text-emerald-500'
                        )}>
                          {formatCurrency(creditImpact.available)}
                        </p>
                      </div>
                    </div>
                  )}

                  {creditImpact?.overLimit && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <span className="font-medium text-red-600">Over Credit Limit</span>
                        <p className="text-muted-foreground">
                          This order would exceed credit limit by{' '}
                          {formatCurrency(creditImpact.overLimitAmount)}
                        </p>
                      </div>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {clientsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No clients found
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {filteredClients.slice(0, 10).map((client: WholesaleClient) => (
                        <Card
                          key={client.id}
                          className="p-3 cursor-pointer hover:border-emerald-500 transition-colors"
                          onClick={() => handleClientSelect(client)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{client.business_name}</span>
                              <p className="text-xs text-muted-foreground">{client.contact_name}</p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="font-mono">{formatCurrency(client.credit_limit - client.outstanding_balance)}</p>
                              <p className="text-xs text-muted-foreground">available</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Price Adjustment */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing Adjustment
              </Label>
              <Select
                value={priceAdjustment}
                onValueChange={(value: 'keep' | 'wholesale' | 'custom') => setPriceAdjustment(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pricing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep Original Prices</SelectItem>
                  <SelectItem value="wholesale">Apply 15% Wholesale Discount</SelectItem>
                  <SelectItem value="custom">Custom Discount</SelectItem>
                </SelectContent>
              </Select>

              {priceAdjustment === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={customDiscount}
                    onChange={(e) => setCustomDiscount(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">% discount</span>
                </div>
              )}
            </div>

            {/* Order Items Preview */}
            <div className="space-y-3">
              <Label>Order Items ({orderItems.length})</Label>
              <Card className="divide-y">
                {orderItems.map((item, index) => (
                  <div key={item.id || index} className="p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">
                        {item.product_name || `Product ${item.product_id}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Qty: {item.quantity}
                      </span>
                    </div>
                    <div className="text-right">
                      {priceAdjustment !== 'keep' && (
                        <p className="text-xs text-muted-foreground line-through">
                          {formatCurrency(item.original_price)}
                        </p>
                      )}
                      <p className="font-mono font-medium">{formatCurrency(item.adjusted_price)}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            {/* Delivery Address */}
            {selectedClient && (
              <div className="space-y-2">
                <Label htmlFor="delivery-address">Delivery Address</Label>
                <Input
                  id="delivery-address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Enter delivery address"
                />
              </div>
            )}

            {/* New Total */}
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Original:</span>
                  <span className="font-mono line-through">{formatCurrency(order.total_amount)}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">New B2B Total:</span>
                  <span className="font-mono font-bold text-lg">{formatCurrency(newTotal)}</span>
                </div>
              </div>
              {priceAdjustment !== 'keep' && (
                <div className="mt-2 text-xs text-muted-foreground text-right">
                  Savings: {formatCurrency(order.total_amount - newTotal)} (
                  {((1 - newTotal / order.total_amount) * 100).toFixed(1)}%)
                </div>
              )}
            </Card>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedClient || orderItems.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Create B2B Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
