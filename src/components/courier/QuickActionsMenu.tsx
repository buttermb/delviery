import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Navigation, Phone, MessageSquare, MapPin, 
  Clock, Fuel, Coffee, AlertCircle 
} from 'lucide-react';
import { motion } from 'framer-motion';

interface QuickActionsMenuProps {
  hasActiveOrder: boolean;
  customerPhone?: string;
  onNavigate?: () => void;
  onCallCustomer?: () => void;
  onReportIssue?: () => void;
}

export default function QuickActionsMenu({
  hasActiveOrder,
  customerPhone,
  onNavigate,
  onCallCustomer,
  onReportIssue
}: QuickActionsMenuProps) {
  const quickActions = [
    {
      id: 'navigate',
      label: 'Navigate',
      icon: Navigation,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      onClick: onNavigate,
      disabled: !hasActiveOrder
    },
    {
      id: 'call',
      label: 'Call',
      icon: Phone,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      onClick: onCallCustomer,
      disabled: !customerPhone || !hasActiveOrder
    },
    {
      id: 'break',
      label: 'Break',
      icon: Coffee,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      onClick: () => {},
      disabled: hasActiveOrder
    },
    {
      id: 'issue',
      label: 'Report',
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      onClick: onReportIssue,
      disabled: false
    }
  ];

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        Quick Actions
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Button
              variant="outline"
              size="sm"
              className={`flex-col h-auto py-3 ${action.disabled ? 'opacity-50' : ''}`}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              <div className={`${action.bgColor} p-2 rounded-lg mb-1`}>
                <action.icon className={`w-4 h-4 ${action.color}`} />
              </div>
              <span className="text-xs">{action.label}</span>
            </Button>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

const Zap = (props: any) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);