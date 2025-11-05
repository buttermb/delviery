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
    title: 'Real-Time Metrics',
    description: 'Track revenue, orders, and key performance indicators at a glance.',
    position: { top: '12%', left: '50%' }
  },
  {
    target: 'chart',
    title: 'Sales Analytics',
    description: 'Visualize your performance trends with interactive charts.',
    position: { top: '35%', left: '50%' }
  },
  {
    target: 'products',
    title: 'Top Products',
    description: 'See what\'s selling best and optimize your inventory.',
    position: { top: '62%', left: '25%' }
  },
  {
    target: 'inventory',
    title: 'Smart Alerts',
    description: 'Never run out of stock with intelligent inventory monitoring.',
    position: { top: '62%', left: '75%' }
  },
  {
    target: 'transfers',
    title: 'Delivery Management',
    description: 'Track pending transfers and manage your logistics efficiently.',
    position: { top: '85%', left: '75%' }
  },
  {
    target: 'map',
    title: 'Fleet Tracking',
    description: 'Monitor your warehouses and runners in real-time on the map.',
    position: { top: '92%', left: '50%' }
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
    <div className="relative max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -20 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h2 className="text-3xl font-bold mb-2">Dashboard Preview</h2>
          <p className="text-muted-foreground">Experience the power of your command center</p>
        </div>
        {currentStep === -1 && (
          <Button onClick={startTour} size="lg" className="gap-2">
            <Play className="h-4 w-4" />
            Take Interactive Tour
          </Button>
        )}
      </motion.div>

      {/* Metrics Grid */}
      <motion.div
        id="metrics"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6"
      >
        {mockDashboardData.metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={isVisible ? { 
                opacity: 1, 
                y: 0, 
                scale: 1,
                transition: {
                  delay: i * 0.08,
                  duration: 0.5
                }
              } : { opacity: 0, y: 30, scale: 0.95 }}
              whileHover={{ scale: 1.03, y: -4 }}
            >
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg bg-muted ${metric.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold mb-1">{metric.value}</div>
                <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                <div className="text-xs text-emerald-600 font-medium">{metric.change}</div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Sales Chart - Full Width */}
      <motion.div
        id="chart"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={isVisible ? { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          transition: {
            delay: 0.48,
            duration: 0.5
          }
        } : { opacity: 0, y: 30, scale: 0.95 }}
        className="mb-6"
      >
        <SalesChartPreview />
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={isVisible ? { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          transition: {
            delay: 0.56,
            duration: 0.5
          }
        } : { opacity: 0, y: 30, scale: 0.95 }}
        className="mb-6"
      >
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: ShoppingCart, label: 'New Order', color: 'text-blue-500' },
              { icon: Package, label: 'Add Product', color: 'text-green-500' },
              { icon: Users, label: 'Customers', color: 'text-purple-500' },
              { icon: FileText, label: 'Reports', color: 'text-orange-500' },
              { icon: BarChart3, label: 'Analytics', color: 'text-pink-500' },
              { icon: Settings, label: 'Settings', color: 'text-slate-500' }
            ].map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <Icon className={`h-6 w-6 ${action.color}`} />
                  <span className="text-xs font-medium">{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        </Card>
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Top Products */}
        <motion.div
          id="products"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={isVisible ? { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              delay: 0.64,
              duration: 0.5
            }
          } : { opacity: 0, y: 30, scale: 0.95 }}
        >
          <TopProductsPreview />
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          id="activity"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={isVisible ? { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              delay: 0.72,
              duration: 0.5
            }
          } : { opacity: 0, y: 30, scale: 0.95 }}
        >
          <EnhancedActivityFeed />
        </motion.div>

        {/* Inventory Alerts */}
        <motion.div
          id="inventory"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={isVisible ? { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              delay: 0.80,
              duration: 0.5
            }
          } : { opacity: 0, y: 30, scale: 0.95 }}
        >
          <InventoryAlertsPreview />
        </motion.div>

        {/* Pending Transfers */}
        <motion.div
          id="transfers"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={isVisible ? { 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              delay: 0.88,
              duration: 0.5
            }
          } : { opacity: 0, y: 30, scale: 0.95 }}
        >
          <PendingTransfersPreview />
        </motion.div>
      </div>

      {/* Location Map - Full Width */}
      <motion.div
        id="map"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={isVisible ? { 
          opacity: 1, 
          y: 0, 
          scale: 1,
          transition: {
            delay: 0.96,
            duration: 0.5
          }
        } : { opacity: 0, y: 30, scale: 0.95 }}
      >
        <LocationMapPreview />
      </motion.div>

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
