import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GuideTooltip } from './GuideTooltip';
import { mockDashboardData } from './mockDashboardData';
import { SalesChartPreview } from './dashboard/SalesChartPreview';
import { TopProductsPreview } from './dashboard/TopProductsPreview';
import { InventoryAlertsPreview } from './dashboard/InventoryAlertsPreview';
import { PendingTransfersPreview } from './dashboard/PendingTransfersPreview';
import { LocationMapPreview } from './dashboard/LocationMapPreview';
import { EnhancedActivityFeed } from './dashboard/EnhancedActivityFeed';
import { 
  ShoppingCart, 
  Package, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  Play
} from 'lucide-react';

const tourSteps = [
  {
    target: 'metrics',
    title: 'Real-time Metrics',
    description: 'Track revenue, orders, and customer activity at a glance.',
    position: { top: '12%', left: '50%' }
  },
  {
    target: 'chart',
    title: 'Sales Analytics',
    description: 'Visualize your sales performance with interactive charts.',
    position: { top: '35%', left: '50%' }
  },
  {
    target: 'activity',
    title: 'Live Activity Feed',
    description: 'Monitor system events in real-time.',
    position: { top: '62%', left: '25%' }
  },
  {
    target: 'inventory',
    title: 'Inventory Alerts',
    description: 'Get alerts for low stock items.',
    position: { top: '62%', left: '75%' }
  }
];

export function EnhancedDashboardPreview() {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const startTour = () => setCurrentStep(0);
  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCurrentStep(-1);
    }
  };
  const skipTour = () => setCurrentStep(-1);

  return (
    <div className="relative max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -20 }}
        className="text-center mb-6"
      >
        <h2 className="text-3xl font-bold mb-3">Complete Wholesale Management</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Everything you need to manage your wholesale operations
        </p>
        {currentStep === -1 && (
          <Button onClick={startTour} size="lg" className="gap-2 mt-4">
            <Play className="h-4 w-4" />
            Take a Quick Tour
          </Button>
        )}
      </motion.div>

      {/* Metrics Grid */}
      <motion.div
        id="metrics"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4"
      >
        {mockDashboardData.metrics.slice(0, 4).map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { 
                opacity: 1, 
                y: 0,
                transition: {
                  delay: i * 0.1,
                  duration: 0.5
                }
              } : { opacity: 0, y: 20 }}
              whileHover={{ y: -2, boxShadow: '0 8px 20px -8px rgba(0,0,0,0.2)' }}
            >
              <Card className="p-3 bg-card/50 backdrop-blur border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                    <p className="text-xl font-bold">{metric.value}</p>
                    <p className={`text-xs mt-0.5 ${metric.change.startsWith('+') ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {metric.change}
                    </p>
                  </div>
                  <div className={`p-2 rounded-full bg-muted ${metric.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Chart and Top Products - Side by Side */}
      <div id="chart" className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { 
            opacity: 1, 
            y: 0,
            transition: {
              delay: 0.4,
              duration: 0.5
            }
          } : { opacity: 0, y: 20 }}
          className="lg:col-span-3"
        >
          <SalesChartPreview />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { 
            opacity: 1, 
            y: 0,
            transition: {
              delay: 0.5,
              duration: 0.5
            }
          } : { opacity: 0, y: 20 }}
          className="lg:col-span-2"
        >
          <TopProductsPreview />
        </motion.div>
      </div>

      {/* Activity Feed and Inventory Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <motion.div
          id="activity"
          initial={{ opacity: 0, x: -20 }}
          animate={isVisible ? { 
            opacity: 1, 
            x: 0,
            transition: {
              delay: 0.6,
              duration: 0.5
            }
          } : { opacity: 0, x: -20 }}
        >
          <EnhancedActivityFeed />
        </motion.div>
        
        <motion.div
          id="inventory"
          initial={{ opacity: 0, x: 20 }}
          animate={isVisible ? { 
            opacity: 1, 
            x: 0,
            transition: {
              delay: 0.7,
              duration: 0.5
            }
          } : { opacity: 0, x: 20 }}
        >
          <InventoryAlertsPreview />
        </motion.div>
      </div>

      {/* Tour Tooltips */}
      {currentStep >= 0 && currentStep < tourSteps.length && (
        <GuideTooltip
          step={currentStep + 1}
          totalSteps={tourSteps.length}
          title={tourSteps[currentStep].title}
          description={tourSteps[currentStep].description}
          position={tourSteps[currentStep].position}
          onNext={nextStep}
          onSkip={skipTour}
        />
      )}

      {/* Pointer Animation */}
      {currentStep >= 0 && (
        <motion.div
          className="fixed pointer-events-none z-50"
          animate={{
            top: tourSteps[currentStep].position.top,
            left: tourSteps[currentStep].position.left,
            x: '-50%',
            y: '-50%'
          }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <motion.div
            className="relative"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="h-16 w-16 rounded-full bg-primary/20 absolute inset-0 animate-ping" />
            <div className="h-16 w-16 rounded-full bg-primary/40 flex items-center justify-center">
              <div className="h-8 w-8 rounded-full bg-primary" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
