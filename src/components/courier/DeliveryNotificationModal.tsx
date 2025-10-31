import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, DollarSign, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { playNotificationSound } from '@/utils/notificationSound';
import { toast } from '@/hooks/use-toast';

interface DeliveryRequest {
  id: string;
  order_number: string;
  pickup_address: string;
  delivery_address: string;
  estimated_distance: number;
  estimated_payout: number;
  estimated_time: number;
  items_count: number;
}

export default function DeliveryNotificationModal() {
  const [delivery, setDelivery] = useState<DeliveryRequest | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    // Subscribe to realtime delivery assignments - simplified for now
    const channel = supabase
      .channel('new-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `status=eq.pending_assignment`
        },
        (payload) => {
          console.log('New order available:', payload);
          // For now, just log - full implementation would check if courier is eligible
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!delivery) return;

    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      handleDecline();
    }
  }, [timeLeft, delivery]);

  const getCurrentCourierId = () => {
    return localStorage.getItem('courier_id') || '';
  };

  const handleAccept = async () => {
    if (!delivery) return;
    
    setIsAccepting(true);
    
    try {
      // Update order to assign to this courier
      const { error } = await supabase
        .from('orders')
        .update({ 
          courier_id: getCurrentCourierId(),
          status: 'assigned'
        })
        .eq('id', delivery.id);

      if (error) throw error;

      toast({
        title: "Delivery Accepted",
        description: "Navigate to pickup location",
      });

      window.location.href = `/courier/dashboard?active=${delivery.id}`;
      
    } catch (error) {
      console.error('Failed to accept delivery:', error);
      toast({
        title: "Error",
        description: "Failed to accept delivery",
        variant: "destructive"
      });
    } finally {
      setIsAccepting(false);
      setDelivery(null);
    }
  };

  const handleDecline = async () => {
    setDelivery(null);
  };

  return (
    <AnimatePresence>
      {delivery && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            className="w-full max-w-md"
          >
            <Card className="bg-white shadow-2xl border-2 border-primary">
              <CardContent className="p-6">
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-primary">🚚 New Delivery!</h3>
                    <div className="bg-destructive text-white px-3 py-1 rounded-full font-bold text-lg animate-pulse">
                      {timeLeft}s
                    </div>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 30, ease: 'linear' }}
                    />
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Package className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">Order #{delivery.order_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {delivery.items_count} item{delivery.items_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">{delivery.estimated_distance.toFixed(1)} miles away</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">Est. {delivery.estimated_time} mins</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-success flex-shrink-0" />
                    <span className="text-xl font-bold text-success">${delivery.estimated_payout.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button
                    onClick={handleDecline}
                    variant="outline"
                    disabled={isAccepting}
                    className="w-full"
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="w-full bg-success hover:bg-success/90"
                  >
                    {isAccepting ? 'Accepting...' : 'Accept'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

