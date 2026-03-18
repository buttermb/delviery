import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Package, Clock, Navigation } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { WholesaleDelivery } from '@/hooks/useWholesaleRunnerDeliveries';
import { formatPhoneNumber } from '@/lib/formatters';

interface RunnerDeliveryCardProps {
  delivery: WholesaleDelivery;
  onAccept?: (deliveryId: string) => void;
  onNavigate?: (address: string) => void;
  onComplete?: (deliveryId: string) => void;
}

export function RunnerDeliveryCard({
  delivery,
  onAccept,
  onNavigate,
  onComplete,
}: RunnerDeliveryCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-500';
      case 'in_transit':
        return 'bg-yellow-500';
      case 'picked_up':
        return 'bg-purple-500';
      case 'delivered':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'New Assignment';
      case 'in_transit':
        return 'In Transit';
      case 'picked_up':
        return 'Picked Up';
      case 'delivered':
        return 'Delivered';
      default:
        return status;
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className={getStatusColor(delivery.status)}>
                {getStatusLabel(delivery.status)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                #{delivery.order.order_number}
              </span>
            </div>
            <h3 className="text-lg font-semibold">
              {delivery.client.business_name}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              ${delivery.total_value.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Order Value</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Delivery Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
            <div>
              <div className="font-medium">Delivery Address</div>
              <div className="text-sm text-muted-foreground">
                {delivery.client.address}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="font-medium">Contact:</span>{' '}
              <span className="text-sm">{delivery.client.contact_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <a
              href={`tel:${delivery.client.phone}`}
              className="text-sm text-primary hover:underline"
            >
              {formatPhoneNumber(delivery.client.phone)}
            </a>
          </div>

          {delivery.scheduled_pickup_time && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Scheduled:</span>{' '}
                {new Date(delivery.scheduled_pickup_time).toLocaleString()}
                <span className="text-muted-foreground ml-2">
                  ({formatDistanceToNow(new Date(delivery.scheduled_pickup_time), { addSuffix: true })})
                </span>
              </div>
            </div>
          )}

          {delivery.notes && (
            <div className="p-3 bg-muted rounded-md">
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Delivery Notes:
              </div>
              <div className="text-sm">{delivery.notes}</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {delivery.status === 'assigned' && onAccept && (
            <Button
              onClick={() => onAccept(delivery.id)}
              className="flex-1"
              size="lg"
            >
              <Package className="h-4 w-4 mr-2" />
              Accept Delivery
            </Button>
          )}

          {(delivery.status === 'in_transit' || delivery.status === 'picked_up') && (
            <>
              {onNavigate && (
                <Button
                  onClick={() => onNavigate(delivery.client.address)}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Navigate
                </Button>
              )}

              {onComplete && (
                <Button
                  onClick={() => onComplete(delivery.id)}
                  className="flex-1"
                  size="lg"
                >
                  Complete Delivery
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
