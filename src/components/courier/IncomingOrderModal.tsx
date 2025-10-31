import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Package, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IncomingOrderModalProps {
  order: any;
  open: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingOrderModal({ order, open, onAccept, onReject }: IncomingOrderModalProps) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!open) return;
    
    setTimeLeft(15);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, onReject]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await onAccept();
      toast.success('Order accepted!');
    } catch (error) {
      toast.error('Failed to accept order');
      setAccepting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">New Delivery Request</DialogTitle>
        <DialogDescription className="sr-only">
          Review delivery details and accept or decline this order. You have {timeLeft} seconds to respond.
        </DialogDescription>
        {/* Map Preview */}
        <div className="h-48 bg-muted relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <Navigation className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>

        {/* Order Details */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">New Delivery Request</h2>
            <div className="flex items-center gap-2 text-primary">
              <Clock className="h-5 w-5" />
              <span className="text-xl font-bold">{timeLeft}s</span>
            </div>
          </div>

          {/* YOUR EARNINGS - Most Important */}
          <div className="bg-green-50 dark:bg-green-950 border-2 border-green-500 rounded-lg p-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">YOUR EARNINGS</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              ${((order.total_amount || 0) * ((order.commission_rate || 30) / 100) + (order.tip_amount || 0)).toFixed(2)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Base: ${((order.total_amount || 0) * ((order.commission_rate || 30) / 100)).toFixed(2)} 
              {order.tip_amount > 0 && ` | Tip: $${order.tip_amount.toFixed(2)}`}
            </p>
          </div>

          {/* ORDER ITEMS - Show what to deliver */}
          {order.order_items && order.order_items.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="font-semibold text-blue-900 dark:text-blue-100">Items to Deliver ({order.order_items.length})</p>
              </div>
              <div className="space-y-2">
                {order.order_items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm bg-white dark:bg-gray-900 p-2 rounded">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {item.product_name || item.products?.name || 'Product'}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ETA */}
          {order.eta_minutes && (
            <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Estimated Time</p>
                <p className="text-lg font-bold">{order.eta_minutes} minutes</p>
              </div>
            </div>
          )}

          {/* Pickup Location */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full">
                <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">PICKUP</p>
                <p className="font-medium">{order.merchant_name || 'Merchant Location'}</p>
                <p className="text-sm text-muted-foreground">{order.pickup_address || 'Address loading...'}</p>
              </div>
            </div>
          </div>

          {/* Delivery Location */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 dark:bg-red-900 p-2 rounded-full">
                <MapPin className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">DELIVERY</p>
                <p className="font-medium">{order.customer_name || 'Customer'}</p>
                <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
                <p className="text-sm text-muted-foreground">{order.delivery_borough}</p>
              </div>
            </div>
          </div>

          {/* Distance */}
          {order.distance_miles && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Navigation className="h-4 w-4" />
              <span>{order.distance_miles} mi</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={onReject}
              disabled={accepting}
            >
              Decline
            </Button>
            <Button
              size="lg"
              onClick={handleAccept}
              disabled={accepting}
              className="bg-green-600 hover:bg-green-700"
            >
              {accepting ? 'Accepting...' : 'Accept Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}