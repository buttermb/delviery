import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Navigation from "lucide-react/dist/esm/icons/navigation";
import Clock from "lucide-react/dist/esm/icons/clock";
import Package from "lucide-react/dist/esm/icons/package";
import { formatDistance } from 'date-fns';
import { motion } from 'framer-motion';

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  delivery_address: string | null;
  total_amount: number;
  created_at: string;
  status: string;
}

interface AvailableOrderCardProps {
  order: Order;
  onAccept: (orderId: string) => void;
  disabled: boolean;
}

export default function AvailableOrderCard({
  order,
  onAccept,
  disabled,
}: AvailableOrderCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <Card className="border-2 hover:border-primary/50 transition-colors">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Order #{order.order_number}</h3>
                <Badge variant="outline">{order.status}</Badge>
              </div>

              {order.customer_name && (
                <p className="text-sm text-muted-foreground">{order.customer_name}</p>
              )}

              {order.delivery_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground line-clamp-2">
                    {order.delivery_address}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm pt-2 border-t">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatDistance(new Date(order.created_at), new Date(), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <span className="font-semibold text-primary text-lg">
                  ${order.total_amount.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              onClick={() => onAccept(order.id)}
              disabled={disabled}
              size="lg"
              className="gap-2 min-w-[120px]"
            >
              <Navigation className="h-4 w-4" />
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
