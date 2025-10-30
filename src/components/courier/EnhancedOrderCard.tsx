import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, DollarSign, Package, Clock, 
  Navigation, Phone, ThumbsUp, ThumbsDown,
  Star, User, Home, TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';

interface EnhancedOrderCardProps {
  order: any;
  onAccept: () => void;
  onReject: () => void;
  estimatedDistance?: number;
  estimatedTime?: number;
  showActions?: boolean;
}

export default function EnhancedOrderCard({
  order,
  onAccept,
  onReject,
  estimatedDistance,
  estimatedTime,
  showActions = true
}: EnhancedOrderCardProps) {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setSwipeDirection('left');
      setTimeout(() => {
        onReject();
        setSwipeDirection(null);
      }, 300);
    },
    onSwipedRight: () => {
      setSwipeDirection('right');
      setTimeout(() => {
        onAccept();
        setSwipeDirection(null);
      }, 300);
    },
    preventScrollOnSwipe: true,
    trackMouse: true
  });

  const potentialEarnings = order.total_amount * 0.15 + (order.tip_amount || 0);
  const itemCount = order.order_items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 0;

  return (
    <motion.div
      {...handlers}
      initial={{ opacity: 0, y: 20 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        x: swipeDirection === 'left' ? -100 : swipeDirection === 'right' ? 100 : 0,
        scale: swipeDirection ? 0.95 : 1
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative"
    >
      <Card className={`overflow-hidden ${
        swipeDirection === 'left' ? 'border-red-500 bg-red-500/5' : 
        swipeDirection === 'right' ? 'border-green-500 bg-green-500/5' : ''
      }`}>
        {/* Swipe Hint Overlays */}
        {swipeDirection && (
          <div className={`absolute inset-0 flex items-center justify-center z-10 ${
            swipeDirection === 'left' ? 'bg-red-500/20' : 'bg-green-500/20'
          }`}>
            <div className="text-center">
              {swipeDirection === 'left' ? (
                <>
                  <ThumbsDown className="w-12 h-12 mx-auto mb-2 text-red-500" />
                  <p className="font-bold text-red-500">Rejecting...</p>
                </>
              ) : (
                <>
                  <ThumbsUp className="w-12 h-12 mx-auto mb-2 text-green-500" />
                  <p className="font-bold text-green-500">Accepting...</p>
                </>
              )}
            </div>
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          {/* Header with Order Number and Earnings */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg">{order.order_number}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  <Package className="w-3 h-3 mr-1" />
                  {itemCount} items
                </Badge>
                {order.special_instructions && (
                  <Badge variant="secondary" className="text-xs">
                    Has notes
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                ${potentialEarnings.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Est. earnings</p>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">{estimatedDistance?.toFixed(1) || '?'} mi</p>
                <p className="text-xs text-muted-foreground">Distance</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="bg-blue-500/10 p-2 rounded-lg">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">{estimatedTime || '?'} min</p>
                <p className="text-xs text-muted-foreground">Est. time</p>
              </div>
            </div>
          </div>

          {/* Location Info */}
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Home className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Pickup</p>
                <p className="text-sm font-medium truncate">
                  {order.merchants?.business_name || 'Merchant'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {order.merchants?.address}
                </p>
              </div>
            </div>
            <div className="border-t pt-2 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Delivery</p>
                <p className="text-sm font-medium truncate">{order.delivery_address}</p>
                <p className="text-xs text-muted-foreground">
                  {order.delivery_borough}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          {order.customer_name && (
            <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{order.customer_name}</span>
              {order.customer_phone && (
                <Phone className="w-3 h-3 ml-auto text-muted-foreground" />
              )}
            </div>
          )}

          {/* Action Buttons */}
          {showActions && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onReject}
                className="border-red-500/50 hover:bg-red-500/10 hover:border-red-500"
              >
                <ThumbsDown className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={onAccept}
                className="bg-green-600 hover:bg-green-700"
              >
                <ThumbsUp className="w-4 h-4 mr-2" />
                Accept
              </Button>
            </div>
          )}

          {/* Swipe Hint */}
          {showActions && !swipeDirection && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              💡 Swipe right to accept, left to reject
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}