import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Package,
  Plus,
  Smartphone,
  Users,
  BarChart3,
  TrendingUp,
  Clock,
  Eye,
  Play,
} from "lucide-react";
import { GuideTooltip } from "./GuideTooltip";
import { AnimatedPointer } from "./AnimatedPointer";

interface GuideStep {
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const guideSteps: GuideStep[] = [
  {
    target: "metrics",
    title: "Real-Time Metrics",
    description: "Track revenue, orders, and inventory at a glance",
    position: "bottom",
  },
  {
    target: "quick-actions",
    title: "Quick Actions",
    description: "Create disposable menus and manage orders with one click",
    position: "bottom",
  },
  {
    target: "activity",
    title: "Live Activity Feed",
    description: "View customer activity and orders as they happen",
    position: "top",
  },
  {
    target: "resources",
    title: "Resource Management",
    description: "Monitor your usage limits and upgrade when needed",
    position: "top",
  },
  {
    target: "cta",
    title: "Get Started in Minutes",
    description: "Start your free trial and set up your wholesale CRM today",
    position: "top",
  },
];

const mockMetrics = {
  todaySales: 2847,
  orderCount: 12,
  lowStock: 3,
  pendingOrders: 5,
};

const mockActivity = [
  { type: "menu_view", message: 'Customer viewed menu "Premium Strains"', time: "2 min ago", icon: Eye },
  { type: "order_placed", message: "Order #A4B2C placed - $489", time: "8 min ago", icon: ShoppingCart },
  { type: "menu_created", message: 'Menu "VIP Catalog" created', time: "1 hour ago", icon: Smartphone },
];

export function GuidedDashboardPreview() {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isVisible, setIsVisible] = useState(false);
  const [animateNumbers, setAnimateNumbers] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      setAnimateNumbers(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleStartTour = () => {
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (currentStep < guideSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setCurrentStep(-1);
    }
  };

  const handleSkip = () => {
    setCurrentStep(-1);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      variants={containerVariants}
      className="w-full max-w-6xl mx-auto"
    >
      {/* Dashboard Preview Container */}
      <div className="relative bg-card/50 backdrop-blur-md rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Overlay when tour is active */}
        <AnimatePresence>
          {currentStep >= 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm z-40 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {/* Dashboard Header */}
        <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-foreground">Dashboard</h3>
              <p className="text-sm text-muted-foreground mt-1">Welcome back, Demo Business</p>
            </div>
            {currentStep === -1 && (
              <Button
                onClick={handleStartTour}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Take Tour
              </Button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Metrics Grid */}
          <div
            id="metrics-target"
            className="relative grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {currentStep === 0 && (
              <>
                <div className="absolute inset-0 bg-primary/10 rounded-lg z-50 pointer-events-none" />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-3 -right-3 z-50"
                >
                  <AnimatedPointer direction="down" />
                </motion.div>
                <GuideTooltip
                  step={1}
                  totalSteps={guideSteps.length}
                  title={guideSteps[0].title}
                  description={guideSteps[0].description}
                  position={guideSteps[0].position}
                  onNext={handleNext}
                  onSkip={handleSkip}
                  className="left-0 right-0 mx-auto"
                />
              </>
            )}

            <motion.div variants={itemVariants}>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    ${animateNumbers ? mockMetrics.todaySales.toLocaleString() : 0}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-success" />
                    <span className="text-success">+12.5%</span> from yesterday
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-info" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {animateNumbers ? mockMetrics.orderCount : 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Today's orders</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {animateNumbers ? mockMetrics.lowStock : 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Items need restocking</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {animateNumbers ? mockMetrics.pendingOrders : 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Orders to process</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div id="quick-actions-target" className="relative">
            {currentStep === 1 && (
              <>
                <div className="absolute inset-0 bg-primary/10 rounded-lg z-50 pointer-events-none" />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-3 -right-3 z-50"
                >
                  <AnimatedPointer direction="down" />
                </motion.div>
                <GuideTooltip
                  step={2}
                  totalSteps={guideSteps.length}
                  title={guideSteps[1].title}
                  description={guideSteps[1].description}
                  position={guideSteps[1].position}
                  onNext={handleNext}
                  onSkip={handleSkip}
                  className="left-0 right-0 mx-auto"
                />
              </>
            )}

            <motion.div variants={itemVariants}>
              <h4 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h4>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { icon: Smartphone, label: "Create Menu", color: "text-primary" },
                  { icon: ShoppingCart, label: "New Order", color: "text-info" },
                  { icon: Package, label: "Add Product", color: "text-success" },
                  { icon: Users, label: "Add Customer", color: "text-warning" },
                  { icon: BarChart3, label: "View Reports", color: "text-muted-foreground" },
                  { icon: Plus, label: "More", color: "text-muted-foreground" },
                ].map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto py-4 flex flex-col items-center gap-2 bg-card/50 hover:bg-card/80"
                  >
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                    <span className="text-xs text-foreground">{action.label}</span>
                  </Button>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <div id="activity-target" className="relative">
            {currentStep === 2 && (
              <>
                <div className="absolute inset-0 bg-primary/10 rounded-lg z-50 pointer-events-none" />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-3 -right-3 z-50"
                >
                  <AnimatedPointer direction="up" />
                </motion.div>
                <GuideTooltip
                  step={3}
                  totalSteps={guideSteps.length}
                  title={guideSteps[2].title}
                  description={guideSteps[2].description}
                  position={guideSteps[2].position}
                  onNext={handleNext}
                  onSkip={handleSkip}
                  className="left-0 right-0 mx-auto"
                />
              </>
            )}

            <motion.div variants={itemVariants}>
              <h4 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h4>
              <Card className="bg-card/80 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {mockActivity.map((activity, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 + 0.5 }}
                        className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0"
                      >
                        <div className="p-2 rounded-lg bg-primary/10">
                          <activity.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{activity.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Resource Usage */}
          <div id="resources-target" className="relative">
            {currentStep === 3 && (
              <>
                <div className="absolute inset-0 bg-primary/10 rounded-lg z-50 pointer-events-none" />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-3 -right-3 z-50"
                >
                  <AnimatedPointer direction="up" />
                </motion.div>
                <GuideTooltip
                  step={4}
                  totalSteps={guideSteps.length}
                  title={guideSteps[3].title}
                  description={guideSteps[3].description}
                  position={guideSteps[3].position}
                  onNext={handleNext}
                  onSkip={handleSkip}
                  className="left-0 right-0 mx-auto"
                />
              </>
            )}

            <motion.div variants={itemVariants}>
              <h4 className="text-sm font-semibold text-foreground mb-3">Resource Usage</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Customers", current: 24, limit: 50, color: "bg-success" },
                  { label: "Menus", current: 8, limit: 10, color: "bg-info" },
                  { label: "Products", current: 120, limit: 200, color: "bg-warning" },
                ].map((resource, index) => (
                  <Card key={index} className="bg-card/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-foreground">{resource.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {resource.current}/{resource.limit}
                        </Badge>
                      </div>
                      <Progress
                        value={(resource.current / resource.limit) * 100}
                        className="h-2"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA below dashboard */}
      <div id="cta-target" className="relative mt-8 text-center">
        {currentStep === 4 && (
          <>
            <div className="absolute inset-0 bg-primary/10 rounded-lg z-50 pointer-events-none" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-50"
            >
              <AnimatedPointer direction="up" />
            </motion.div>
            <GuideTooltip
              step={5}
              totalSteps={guideSteps.length}
              title={guideSteps[4].title}
              description={guideSteps[4].description}
              position={guideSteps[4].position}
              onNext={handleNext}
              onSkip={handleSkip}
              className="left-1/2 -translate-x-1/2"
            />
          </>
        )}
      </div>
    </motion.div>
  );
}
