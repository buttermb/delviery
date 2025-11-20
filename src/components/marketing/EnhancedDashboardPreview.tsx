import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockDashboardData } from './mockDashboardData';
import { SalesChartPreview } from './dashboard/SalesChartPreview';
import { TopProductsPreview } from './dashboard/TopProductsPreview';
import { InventoryAlertsPreview } from './dashboard/InventoryAlertsPreview';
import { EnhancedActivityFeed } from './dashboard/EnhancedActivityFeed';
import { MiniSidebarPreview } from './dashboard/MiniSidebarPreview';
import { AnimatedMetricValue } from './dashboard/AnimatedMetricValue';
import { dashboardViews, DashboardViewKey } from './dashboard/DashboardViews';
import { SuperstarFeaturesCard } from './dashboard/SuperstarFeaturesCard';

export function EnhancedDashboardPreview() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeView, setActiveView] = useState<DashboardViewKey>('dashboard');

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full max-w-[900px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -20 }}
        className="text-center mb-4 px-4"
      >
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 text-white">Complete Cannabis Distribution Management</h2>
        <p className="text-slate-300 max-w-2xl mx-auto text-xs sm:text-sm">
          Everything you need to manage your cannabis distribution operations in one dashboard
        </p>
      </motion.div>

      {/* Browser Chrome Mockup */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
        transition={{ delay: 0.2 }}
        className="bg-slate-900 rounded-t-lg border border-border/50 border-b-0 mx-2 sm:mx-0"
      >
        <div className="p-1.5 sm:p-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500" />
          </div>
          <div className="flex-1 bg-slate-800 rounded px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs text-slate-400 font-mono truncate">
            dashboard.yourapp.com
          </div>
        </div>
      </motion.div>

      {/* Unified Dashboard Panel */}
      <div className="flex flex-col sm:flex-row bg-card/80 backdrop-blur-sm border border-border/50 border-t-0 rounded-b-lg shadow-lg overflow-hidden ring-2 ring-primary/10 mx-2 sm:mx-0 relative">
        {/* Sidebar - Hidden on mobile, Interactive */}
        <div className="hidden sm:block">
          <MiniSidebarPreview activeView={activeView} onViewChange={setActiveView} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-2 sm:p-3 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Superstar Features Card */}
                <div>
                  <SuperstarFeaturesCard onViewChange={setActiveView} />
                </div>

                {/* Metrics Grid */}
                <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mb-2">
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
                whileHover={{ y: -1 }}
              >
                <div className="p-1.5 bg-muted/30 rounded border border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] sm:text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide truncate">{metric.label}</p>
                      <p className="text-sm sm:text-base font-bold">
                        <AnimatedMetricValue value={metric.value} duration={1.5} delay={i * 0.1} />
                      </p>
                      <p className={`text-[8px] sm:text-[9px] mt-0.5 ${metric.change.startsWith('+') ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {metric.change}
                      </p>
                    </div>
                    <div className={`p-1 rounded-full bg-muted ${metric.color}`}>
                      <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          </motion.div>

          {/* Chart and Top Products - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 sm:gap-2 mb-2">
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
              className="sm:col-span-3"
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
              className="sm:col-span-2"
            >
              <TopProductsPreview />
            </motion.div>
          </div>

          {/* Activity Feed and Inventory Alerts - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
            <motion.div
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
              </motion.div>
            ) : (
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <div className="mb-3">
                  <h3 className="text-lg font-bold">{dashboardViews[activeView].title}</h3>
                  <p className="text-xs text-muted-foreground">{dashboardViews[activeView].description}</p>
                </div>
                <div className="h-[400px] overflow-y-auto">
                  {dashboardViews[activeView].preview}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
