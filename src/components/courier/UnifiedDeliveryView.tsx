import { useCourier } from '@/contexts/CourierContext';
import { useWholesaleRunnerDeliveries } from '@/hooks/useWholesaleRunnerDeliveries';
import { RunnerDeliveryCard } from './RunnerDeliveryCard';
import AvailableOrderCard from './AvailableOrderCard';
import { AnimatePresence, motion } from 'framer-motion';

interface UnifiedDeliveryViewProps {
  courierOrders: any[];
  onAcceptOrder: (orderId: string) => void;
  onCompleteDelivery: (deliveryId: string) => void;
}

export function UnifiedDeliveryView({ 
  courierOrders, 
  onAcceptOrder,
  onCompleteDelivery 
}: UnifiedDeliveryViewProps) {
  const { courier, role } = useCourier();
  const { data: runnerDeliveries = [] } = useWholesaleRunnerDeliveries(
    role === 'runner' ? courier?.id : undefined
  );

  const handleNavigate = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  if (role === 'runner') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <AnimatePresence>
          {runnerDeliveries.map((delivery) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <RunnerDeliveryCard
                delivery={delivery}
                onNavigate={handleNavigate}
                onComplete={onCompleteDelivery}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AnimatePresence>
        {courierOrders.map((order) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AvailableOrderCard order={order} onAccept={onAcceptOrder} disabled={false} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
