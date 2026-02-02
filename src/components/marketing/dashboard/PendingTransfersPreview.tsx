import { motion } from 'framer-motion';
import Truck from "lucide-react/dist/esm/icons/truck";
import Clock from "lucide-react/dist/esm/icons/clock";
import User from "lucide-react/dist/esm/icons/user";
import Package from "lucide-react/dist/esm/icons/package";
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockDashboardData } from '../mockDashboardData';

export function PendingTransfersPreview() {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'assigned':
        return { variant: 'default', color: 'text-blue-600' };
      case 'scheduled':
        return { variant: 'secondary', color: 'text-slate-600' };
      default:
        return { variant: 'outline', color: 'text-muted-foreground' };
    }
  };

  return (
    <Card className="p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          Pending Transfers
        </h3>
        <button className="text-sm text-primary hover:underline">View All</button>
      </div>

      <div className="space-y-3">
        {mockDashboardData.pendingTransfers.map((transfer, index) => {
          const statusConfig = getStatusConfig(transfer.status);

          return (
            <motion.div
              key={transfer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: index * 0.1,
                duration: 0.4
              }}
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer relative"
            >
              {/* Timeline dot */}
              <div className="absolute -left-3 top-6 h-2 w-2 rounded-full bg-primary" />
              
              <div className="space-y-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">Order #{transfer.id}</div>
                    <div className="text-sm text-muted-foreground">{transfer.customer}</div>
                  </div>
                  <Badge variant={statusConfig.variant as 'default' | 'secondary' | 'destructive' | 'outline'} className="text-xs capitalize">
                    {transfer.status}
                  </Badge>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {transfer.time}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {transfer.weight}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" />
                    {transfer.driver}
                  </div>
                  <div className="font-semibold text-foreground">
                    {transfer.value}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
