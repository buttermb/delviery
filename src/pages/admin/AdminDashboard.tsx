import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  Truck,
  Store,
  Shield,
  Clock,
  Activity,
  Bell,
  Zap,
  DollarSign,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedMetricCard } from "@/components/admin/AnimatedMetricCard";
import { RealtimeActivityFeed } from "@/components/admin/RealtimeActivityFeed";
import { QuickActionGrid } from "@/components/admin/QuickActionGrid";
import { RealtimeIndicator } from "@/components/RealtimeIndicator";
import { motion } from "framer-motion";

interface DashboardMetrics {
  totalOrders: number;
  todayOrders: number;
  activeOrders: number;
  totalUsers: number;
  totalMerchants: number;
  activeCouriers: number;
  pendingVerifications: number;
  flaggedOrders: number;
  todayRevenue: number;
}

const AdminDashboard = () => {
  const { session } = useAdminAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeActivity, setRealtimeActivity] = useState<any[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState({ status: "healthy", unresolvedFlags: 0, activeUsers: 0, ordersLastHour: 0 });
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (session) {
      fetchDashboardMetrics();
      fetchSystemHealth();
      setupRealtimeSubscription();
    }
  }, [session]);

  const setupRealtimeSubscription = () => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    
    const setupChannel = async () => {
      try {
        channel = supabase
          .channel('admin-dashboard-realtime', {
            config: {
              broadcast: { self: false },
              presence: { key: '' }
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
            if (isMounted) {
              setLastUpdate(new Date());
              setRealtimeActivity(prev => [{
                type: 'new_order',
                message: `New order #${payload.new.order_number}`,
                timestamp: new Date(),
                data: payload.new
              }, ...prev].slice(0, 10));
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fraud_flags' }, (payload) => {
            if (isMounted) {
              setLastUpdate(new Date());
              setSystemAlerts(prev => [{
                type: 'fraud_alert',
                severity: 'high',
                message: `Fraud detected: ${payload.new.flag_type}`,
                timestamp: new Date()
              }, ...prev].slice(0, 5));
            }
          })
          .subscribe((status) => {
            if (isMounted) {
              setIsConnected(status === 'SUBSCRIBED');
              if (status === 'SUBSCRIBED') setLastUpdate(new Date());
            }
            if (status === 'CHANNEL_ERROR' && isMounted) {
              console.error('Failed to subscribe to admin dashboard channel');
              setIsConnected(false);
            }
          });
      } catch (error) {
        console.error('Error setting up realtime channel:', error);
        if (isMounted) setIsConnected(false);
      }
    };

    setupChannel();

    return () => { 
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel).catch(err => {
          console.error('Error removing channel:', err);
        });
      }
    };
  };

  const fetchSystemHealth = async () => {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [unresolvedFlags, activeOrders] = await Promise.all([
        supabase.from("fraud_flags").select("*", { count: "exact" }).is("resolved_at", null),
        supabase.from("orders").select("*", { count: "exact" }).gte("created_at", oneHourAgo.toISOString()),
      ]);

      setSystemHealth({
        status: (unresolvedFlags.count || 0) > 10 ? "warning" : "healthy",
        unresolvedFlags: unresolvedFlags.count || 0,
        activeUsers: 0,
        ordersLastHour: activeOrders.count || 0
      });
    } catch (error) {
      console.error("Failed to fetch system health:", error);
    }
  };

  const fetchDashboardMetrics = async () => {
    try {
      // Use optimized RPC function for instant metrics
      const { data, error } = await supabase.rpc('get_admin_dashboard_metrics');

      if (error) throw error;
      setMetrics(data as unknown as DashboardMetrics);
    } catch (error) {
      console.error("Failed to fetch dashboard metrics:", error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            Real-time metrics and key performance indicators
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator isConnected={isConnected} lastUpdate={lastUpdate} />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500 }}
          >
            <Badge variant={systemHealth.status === "healthy" ? "default" : "destructive"} className="gap-1">
              <Activity className="h-3 w-3" />
              {systemHealth.status === "healthy" ? "System Healthy" : "Attention Required"}
            </Badge>
          </motion.div>
        </div>
      </motion.div>

      {/* System Health Snapshot with Animation */}
      <div className="grid gap-4 md:grid-cols-4">
        <AnimatedMetricCard
          title="Orders (Last Hour)"
          value={systemHealth.ordersLastHour}
          icon={Zap}
          trend="Real-time tracking"
          gradient
          delay={0}
        />
        <AnimatedMetricCard
          title="Unresolved Flags"
          value={systemHealth.unresolvedFlags}
          icon={Shield}
          trend="Review now"
          onClick={() => navigate("/admin/users")}
          delay={0.1}
        />
        <AnimatedMetricCard
          title="System Alerts"
          value={systemAlerts.length}
          icon={Bell}
          trend="Active notifications"
          delay={0.2}
        />
        <AnimatedMetricCard
          title="Revenue Today"
          value={`$${(metrics?.todayRevenue || 0).toFixed(2)}`}
          icon={DollarSign}
          trend={`From ${metrics?.todayOrders || 0} orders`}
          gradient
          delay={0.3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnimatedMetricCard title="Total Orders" value={metrics?.totalOrders || 0} icon={ShoppingCart} trend="All time" delay={0.4} />
        <AnimatedMetricCard title="Today's Orders" value={metrics?.todayOrders || 0} icon={Clock} trend={`$${(metrics?.todayRevenue || 0).toFixed(2)} revenue`} delay={0.45} />
        <AnimatedMetricCard title="Active Orders" value={metrics?.activeOrders || 0} icon={Truck} trend="In progress" delay={0.5} />
        <AnimatedMetricCard title="Total Users" value={metrics?.totalUsers || 0} icon={Users} trend="Registered" delay={0.55} />
        <AnimatedMetricCard title="Active Merchants" value={metrics?.totalMerchants || 0} icon={Store} trend="Verified" delay={0.6} />
        <AnimatedMetricCard title="Online Couriers" value={metrics?.activeCouriers || 0} icon={Truck} trend="Available now" delay={0.65} onClick={() => navigate("/admin/couriers")} />
        <AnimatedMetricCard title="Pending Verifications" value={metrics?.pendingVerifications || 0} icon={Shield} trend="Awaiting review" delay={0.7} />
        <AnimatedMetricCard title="Flagged Orders" value={metrics?.flaggedOrders || 0} icon={AlertTriangle} trend="Requires attention" delay={0.75} />
      </div>

      {/* Real-time Activity & Alerts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="grid gap-4 md:grid-cols-2"
      >
        <RealtimeActivityFeed activities={realtimeActivity} />
        
        <RealtimeActivityFeed 
          activities={systemAlerts.map(alert => ({
            type: alert.type,
            message: alert.message,
            timestamp: alert.timestamp,
            data: alert
          }))} 
        />
      </motion.div>

      {/* Enhanced Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <QuickActionGrid />
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
