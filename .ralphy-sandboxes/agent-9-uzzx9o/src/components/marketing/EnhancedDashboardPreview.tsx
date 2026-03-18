import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockDashboardData } from './mockDashboardData';
import { SalesChartPreview } from './dashboard/SalesChartPreview';
import { TopProductsPreview } from './dashboard/TopProductsPreview';
import { InventoryAlertsPreview } from './dashboard/InventoryAlertsPreview';
import { EnhancedActivityFeed } from './dashboard/EnhancedActivityFeed';
import { MiniSidebarPreview } from './dashboard/MiniSidebarPreview';
import { AnimatedMetricValue } from './dashboard/AnimatedMetricValue';
import { DashboardViews, DashboardViewKey } from './dashboard/DashboardViews';
import { SuperstarFeaturesCard } from './dashboard/SuperstarFeaturesCard';

export function EnhancedDashboardPreview() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeView, setActiveView] = useState<DashboardViewKey>('dashboard');

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full group">

      {/* Unified Dashboard Panel */}
      <div className="flex flex-col sm:flex-row w-full h-full bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden relative z-10">
        {/* Sidebar - Hidden on mobile, Interactive */}
        <div className="hidden sm:flex flex-col shrink-0 bg-slate-900 border-r border-slate-800">
          <MiniSidebarPreview activeView={activeView} onViewChange={setActiveView} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-2 sm:p-3 relative overflow-hidden min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="relative"
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
                className="h-full flex flex-col"
              >
                <div className="mb-3 flex-shrink-0">
                  <h3 className="text-lg font-bold capitalize">{activeView}</h3>
                  <p className="text-xs text-muted-foreground">Interactive preview for {activeView}</p>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-lg border border-border p-4">
                  <DashboardViews activeView={activeView} isInteractive={true} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
