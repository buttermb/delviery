import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminAlerts } from "@/components/admin/AdminAlerts";
import { formatStatus, safeStatus } from "@/utils/stringHelpers";
import { validateOrder } from "@/utils/realtimeValidation";
import { productionLogger } from "@/utils/productionLogger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Truck, Package, Clock, DollarSign, Users, UserPlus, Bell, BellOff, Maximize, Search, Activity, TrendingUp, Zap, RefreshCw, AlertTriangle, MapIcon, ChevronDown, ChevronUp, Phone, Filter, X, BarChart3 } from "lucide-react";
import { AssignCourierDialog } from "@/components/admin/AssignCourierDialog";
import { useToast } from "@/hooks/use-toast";
import { OrderMap } from "@/components/admin/OrderMap";

interface RealtimeStats {
  ordersLastHour: number;
  revenueLastHour: number;
  activeCouriers: number;
  avgDeliveryTime: number;
  activeUsers: number;
  ordersInProgress: number;
  completionRate: number;
  avgOrderValue: number;
  peakHours: string;
  topBorough: string;
}

interface ActivityItem {
  id: string;
  type: 'order' | 'delivery' | 'courier' | 'alert';
  message: string;
  timestamp: Date;
  severity?: 'info' | 'warning' | 'success' | 'error';
}

const AdminLiveMap = () => {
  const { session } = useAdminAuth();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [boroughFilter, setBoroughFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [activeCouriers, setActiveCouriers] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const playNotificationSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const addActivity = (type: ActivityItem['type'], message: string, severity: ActivityItem['severity'] = 'info') => {
    const newActivity: ActivityItem = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
      severity
    };
    setActivityFeed(prev => [newActivity, ...prev.slice(0, 49)]);
  };

  const fetchActiveCouriers = async () => {
    try {
      const { data: couriersData, error: couriersError } = await supabase
        .from('couriers')
        .select('*')
        .eq('is_online', true)
        .eq('is_active', true);

      if (couriersError) {
        console.error('Error fetching active couriers:', couriersError);
        return;
      }

      setActiveCouriers(couriersData || []);
    } catch (error) {
      console.error('Error fetching active couriers:', error);
    }
  };

  const fetchLiveDeliveries = async () => {
    try {
      // Fetch active orders with all necessary details
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            product_name,
            quantity,
            price
          ),
          couriers (
            id,
            full_name,
            phone,
            vehicle_type,
            current_lat,
            current_lng,
            rating
          )
        `)
        .in('status', ['confirmed', 'preparing', 'out_for_delivery'])
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }
      
      console.log('Fetched orders:', ordersData);
      
      // Transform to match expected format with all fields
      const deliveriesData = ordersData?.map(order => ({
        id: order.id,
        order_id: order.id,
        order: {
          ...order,
          items: order.order_items || [],
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          delivery_address: order.delivery_address,
          delivery_borough: order.delivery_borough,
          total_amount: order.total_amount,
          subtotal: order.subtotal,
          delivery_fee: order.delivery_fee
        },
        courier: order.couriers,
        created_at: order.created_at,
        dropoff_lat: order.dropoff_lat,
        dropoff_lng: order.dropoff_lng
      })) || [];
      
      console.log('Transformed deliveries:', deliveriesData);
      
      const previousCount = deliveries.length;
      setDeliveries(deliveriesData);
      
      if (deliveriesData && deliveriesData.length > previousCount) {
        playNotificationSound();
        addActivity('order', `New order received! Total active: ${deliveriesData.length}`, 'success');
      }

      // Fetch active couriers
      await fetchActiveCouriers();
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      addActivity('alert', 'Failed to fetch deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRealtimeStats = async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const [ordersResult, revenueResult, couriersResult, completedResult] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', oneHourAgo),
        supabase.from('orders').select('total_amount').gte('created_at', oneHourAgo).eq('status', 'delivered'),
        supabase.from('couriers').select('*', { count: 'exact', head: true }).eq('is_online', true).eq('is_active', true),
        supabase.from('orders').select('delivered_at, created_at').eq('status', 'delivered').gte('created_at', oneHourAgo)
      ]);

      const inProgressResult = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed', 'preparing', 'out_for_delivery']);

      const totalOrdersToday = await supabase
        .from('orders')
        .select('status', { count: 'exact', head: true })
        .gte('created_at', new Date().toDateString());

      const deliveredToday = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'delivered')
        .gte('created_at', new Date().toDateString());

      const avgDeliveryTime = completedResult.data
        ?.map((order: any) => {
          const created = new Date(order.created_at);
          const delivered = new Date(order.delivered_at);
          return (delivered.getTime() - created.getTime()) / 1000 / 60;
        })
        .reduce((a: number, b: number) => a + b, 0) / (completedResult.data?.length || 1);

      const revenue = revenueResult.data?.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0) || 0;
      const avgOrderValue = revenueResult.data?.length ? revenue / revenueResult.data.length : 0;
      const completionRate = totalOrdersToday.count && deliveredToday.count ? (deliveredToday.count / totalOrdersToday.count) * 100 : 0;

      setStats({
        ordersLastHour: ordersResult.count || 0,
        revenueLastHour: revenue,
        activeCouriers: couriersResult.count || 0,
        avgDeliveryTime: Math.round(avgDeliveryTime) || 0,
        activeUsers: 0,
        ordersInProgress: inProgressResult.count || 0,
        completionRate: Math.round(completionRate),
        avgOrderValue,
        peakHours: '12PM-2PM, 6PM-9PM',
        topBorough: 'Manhattan'
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (!session) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    fetchLiveDeliveries();
    fetchRealtimeStats();

    const interval = autoRefresh ? setInterval(() => {
      fetchLiveDeliveries();
      fetchRealtimeStats();
    }, 5000) : null;

    const setupChannel = async () => {
      channel = supabase
        .channel("live-map-updates", {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            try {
              const newRecord = payload.new as any;
              const oldRecord = payload.old as any;

              // Validate payload before processing
              if (!validateOrder(newRecord)) {
                productionLogger.warning('Invalid order payload in realtime', { payload });
                return;
              }

              if (payload.eventType === 'INSERT') {
                addActivity('order', `New order: ${newRecord.order_number}`, 'success');
                playNotificationSound();
              } else if (payload.eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
                addActivity('order', `Order ${newRecord.order_number} → ${safeStatus(newRecord.status)}`, 'info');
              }
              
              fetchLiveDeliveries();
              fetchRealtimeStats();
            } catch (error) {
              productionLogger.error('Error processing order realtime update', { payload, error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "couriers" },
          (payload) => {
            try {
              const courier = payload.new as any;
              if (courier?.is_online && !payload.old?.is_online && courier.full_name) {
                addActivity('courier', `${courier.full_name} is now online`, 'success');
              }
              fetchLiveDeliveries();
            } catch (error) {
              productionLogger.error('Error processing courier realtime update', { payload, error: error instanceof Error ? error.message : 'Unknown error' });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to live map channel');
          }
        });
    };

    setupChannel();

    return () => {
      if (interval) clearInterval(interval);
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, [session, autoRefresh, soundEnabled]);

  const filteredDeliveries = deliveries.filter((delivery) => {
    const order = delivery.order || delivery;
    const statusMatch = statusFilter === "all" || order.status === statusFilter;
    const boroughMatch = boroughFilter === "all" || order.delivery_borough === boroughFilter;
    const searchMatch = !searchQuery || 
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.courier?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return statusMatch && boroughMatch && searchMatch;
  });

  const mapOrders = filteredDeliveries
    .filter(d => {
      const order = d.order || d;
      const lat = order.dropoff_lat ?? d.dropoff_lat;
      const lng = order.dropoff_lng ?? d.dropoff_lng;
      // Only include orders with valid coordinates
      return lat != null && lng != null && !isNaN(lat) && !isNaN(lng);
    })
    .map(d => {
      const order = d.order || d;
      return {
        id: order.id || d.id,
        tracking_code: order.tracking_code || order.order_number || d.tracking_code || '',
        status: order.status || d.status || 'pending',
        delivery_address: order.delivery_address || d.delivery_address || '',
        dropoff_lat: (order.dropoff_lat ?? d.dropoff_lat) as number,
        dropoff_lng: (order.dropoff_lng ?? d.dropoff_lng) as number,
        eta_minutes: order.eta_minutes || d.eta_minutes,
        courier_id: d.courier?.id || order.courier_id,
        courier: d.courier ? {
          full_name: d.courier.full_name,
          current_lat: d.courier.current_lat,
          current_lng: d.courier.current_lng,
          vehicle_type: d.courier.vehicle_type
        } : undefined
      };
    });

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: "bg-gray-500",
      confirmed: "bg-purple-500",
      preparing: "bg-yellow-500",
      out_for_delivery: "bg-blue-500",
      delivered: "bg-green-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'order': return <Package className="h-4 w-4" />;
      case 'delivery': return <Truck className="h-4 w-4" />;
      case 'courier': return <Users className="h-4 w-4" />;
      case 'alert': return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (!session) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Please log in to access the live map.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={isFullscreen ? "h-screen flex flex-col overflow-hidden bg-background" : "min-h-screen bg-background"}>
      
      <AdminAlerts />

      {/* Header */}
      <div className="border-b bg-card px-4 md:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MapIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Live Operations Center</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Real-time delivery tracking & management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{autoRefresh ? 'Auto' : 'Manual'}</span>
            </Button>
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="hidden md:flex"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 md:gap-4 p-4 md:p-6 bg-muted/30 flex-shrink-0">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-3 md:h-4 w-3 md:w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <p className="text-xl md:text-2xl font-bold">{stats?.ordersInProgress || 0}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-3 md:h-4 w-3 md:w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Last Hr</p>
            </div>
            <p className="text-xl md:text-2xl font-bold">{stats?.ordersLastHour || 0}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 md:h-4 w-3 md:w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
            <p className="text-xl md:text-2xl font-bold">${stats?.revenueLastHour?.toFixed(0) || 0}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-3 md:h-4 w-3 md:w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">Couriers</p>
            </div>
            <p className="text-xl md:text-2xl font-bold">{stats?.activeCouriers || 0}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-3 md:h-4 w-3 md:w-4 text-cyan-500" />
              <p className="text-xs text-muted-foreground">Avg Time</p>
            </div>
            <p className="text-xl md:text-2xl font-bold">{stats?.avgDeliveryTime || 0}m</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3 md:h-4 w-3 md:w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Success</p>
            </div>
            <p className="text-xl md:text-2xl font-bold">{stats?.completionRate || 0}%</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-3 md:h-4 w-3 md:w-4 text-yellow-500" />
              <p className="text-xs text-muted-foreground">Avg Order</p>
            </div>
            <p className="text-xl md:text-2xl font-bold">${stats?.avgOrderValue?.toFixed(0) || 0}</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-3 md:h-4 w-3 md:w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Peak Hrs</p>
            </div>
            <p className="text-[10px] md:text-xs font-semibold">{stats?.peakHours || 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className={isFullscreen ? "flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 p-4 md:p-6 min-h-0 overflow-x-auto" : "flex flex-col lg:flex-row gap-4 md:gap-6 p-4 md:p-6"}>
        {/* Left Panel - Map & Controls */}
        <div className={isFullscreen ? "w-full lg:flex-[2] flex flex-col gap-4 min-h-0 flex-shrink-0" : "w-full lg:flex-1 flex flex-col gap-4"}>
          {/* Filters */}
          <Card className="flex-shrink-0">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search orders, customers, couriers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Status Badge Filters */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status Filters:</span>
                    {(statusFilter !== 'all' || boroughFilter !== 'all') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs ml-auto"
                        onClick={() => {
                          setStatusFilter('all');
                          setBoroughFilter('all');
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={statusFilter === 'all' ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setStatusFilter('all')}
                    >
                      All ({deliveries.length})
                    </Badge>
                    <Badge
                      variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                      className={`cursor-pointer ${statusFilter === 'confirmed' ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                      onClick={() => setStatusFilter('confirmed')}
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5"></span>
                      Confirmed ({deliveries.filter(d => (d.order || d).status === 'confirmed').length})
                    </Badge>
                    <Badge
                      variant={statusFilter === 'preparing' ? 'default' : 'outline'}
                      className={`cursor-pointer ${statusFilter === 'preparing' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}`}
                      onClick={() => setStatusFilter('preparing')}
                    >
                      <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5"></span>
                      Preparing ({deliveries.filter(d => (d.order || d).status === 'preparing').length})
                    </Badge>
                    <Badge
                      variant={statusFilter === 'out_for_delivery' ? 'default' : 'outline'}
                      className={`cursor-pointer ${statusFilter === 'out_for_delivery' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                      onClick={() => setStatusFilter('out_for_delivery')}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                      Out for Delivery ({deliveries.filter(d => (d.order || d).status === 'out_for_delivery').length})
                    </Badge>
                  </div>
                </div>

                {/* Borough Select */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={boroughFilter} onValueChange={setBoroughFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter by borough" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">All Boroughs</SelectItem>
                      <SelectItem value="Manhattan">Manhattan</SelectItem>
                      <SelectItem value="Brooklyn">Brooklyn</SelectItem>
                      <SelectItem value="Queens">Queens</SelectItem>
                      <SelectItem value="Bronx">Bronx</SelectItem>
                      <SelectItem value="Staten Island">Staten Island</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                 {/* Results Count */}
                {filteredDeliveries.length !== deliveries.length && (
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredDeliveries.length} of {deliveries.length} orders
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Map */}
          <div className={isFullscreen ? "flex-1 min-h-[600px] rounded-lg overflow-hidden border shadow-lg" : "h-[400px] md:h-[500px] lg:h-[600px] rounded-lg overflow-hidden border shadow-lg"}>
            {loading ? (
              <div className="h-full flex items-center justify-center bg-muted/30">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Loading map...</p>
                </div>
              </div>
            ) : (
              <OrderMap
                orders={mapOrders}
                activeCouriers={activeCouriers}
                selectedOrderId={selectedDelivery?.order?.id || selectedDelivery?.id}
                onOrderSelect={(orderId) => {
                  const delivery = filteredDeliveries.find(d => {
                    const order = d.order || d;
                    return order.id === orderId;
                  });
                  setSelectedDelivery(delivery);
                }}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Orders & Activity */}
        <div className={isFullscreen ? "w-full lg:w-[400px] flex flex-col gap-4 flex-shrink-0 min-w-[400px]" : "w-full lg:w-[400px] flex flex-col gap-4 flex-shrink-0"}>
          <Tabs defaultValue="orders">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="orders">
                Orders ({filteredDeliveries.length})
              </TabsTrigger>
              <TabsTrigger value="activity">
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Active Orders</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px] md:h-[600px]">
                    <div className="space-y-2 p-4">
                      {filteredDeliveries.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No active deliveries</p>
                        </div>
                      ) : (
                        filteredDeliveries.map((delivery) => {
                          const order = delivery.order || delivery;
                          const isExpanded = expandedOrders.has(delivery.id);
                          const items = order.items || [];
                          
                          return (
                            <Card
                              key={delivery.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                selectedDelivery?.id === delivery.id ? 'ring-2 ring-primary' : ''
                              }`}
                              onClick={() => setSelectedDelivery(delivery)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <p className="font-semibold text-base">{order.order_number || 'N/A'}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {order.customer_name || 'No customer name'}
                                    </p>
                                    {order.customer_phone && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">{order.customer_phone}</span>
                                      </div>
                                    )}
                                  </div>
                                  <Badge className={getStatusColor(order.status)}>
                                    {formatStatus(order.status)}
                                  </Badge>
                                </div>

                                {/* Order Total */}
                                <div className="bg-muted/50 rounded-lg p-2 mb-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Total:</span>
                                    <span className="text-lg font-bold text-primary">
                                      ${order.total_amount?.toFixed(2) || '0.00'}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1 text-sm mb-2">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-muted-foreground truncate">
                                      {order.delivery_address || 'No address'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-muted-foreground">
                                      {order.delivery_borough || 'N/A'}
                                    </span>
                                  </div>
                                  {delivery.courier && (
                                    <div className="flex items-center gap-2">
                                      <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="text-muted-foreground">
                                        {delivery.courier.full_name}
                                      </span>
                                    </div>
                                  )}
                                  {order.eta_minutes && (
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                      <span className="text-muted-foreground">
                                        ETA: {order.eta_minutes} min
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Expandable Items Section */}
                                {items.length > 0 && (
                                  <Collapsible
                                    open={isExpanded}
                                    onOpenChange={() => {
                                      const newExpanded = new Set(expandedOrders);
                                      if (isExpanded) {
                                        newExpanded.delete(delivery.id);
                                      } else {
                                        newExpanded.add(delivery.id);
                                      }
                                      setExpandedOrders(newExpanded);
                                    }}
                                  >
                                    <CollapsibleTrigger 
                                      className="flex items-center justify-between w-full p-2 hover:bg-muted/50 rounded transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-sm font-medium">
                                        Items ({items.length})
                                      </span>
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2">
                                      <div className="space-y-2 pl-2 border-l-2 border-muted">
                                        {items.map((item: any, idx: number) => (
                                          <div key={idx} className="text-sm flex justify-between items-start gap-2 py-1">
                                            <div className="flex-1">
                                              <p className="font-medium">{item.product_name || 'Product'}</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-muted-foreground">x{item.quantity}</p>
                                              <p className="font-semibold">${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}

                                {!delivery.courier && order.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    className="w-full mt-3"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOrder(order);
                                      setAssignDialogOpen(true);
                                    }}
                                  >
                                    <UserPlus className="h-3 w-3 mr-2" />
                                    Assign Courier
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Live Activity Feed</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px] md:h-[600px]">
                    <div className="space-y-2 p-4">
                      {activityFeed.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No recent activity</p>
                        </div>
                      ) : (
                        activityFeed.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className={`p-2 rounded-full ${
                              item.severity === 'success' ? 'bg-green-500/10 text-green-500' :
                              item.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                              item.severity === 'error' ? 'bg-red-500/10 text-red-500' :
                              'bg-blue-500/10 text-blue-500'
                            }`}>
                              {getActivityIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{item.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Assign Courier Dialog */}
      {selectedOrder && (
        <AssignCourierDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          orderId={selectedOrder.id}
          orderAddress={selectedOrder.delivery_address || ''}
          onSuccess={() => {
            setAssignDialogOpen(false);
            fetchLiveDeliveries();
            addActivity('courier', `Courier assigned to ${selectedOrder.order_number}`, 'success');
            toast({
              title: "Courier Assigned",
              description: "The courier has been successfully assigned to this order.",
            });
          }}
        />
      )}
    </div>
  );
};

export default AdminLiveMap;
