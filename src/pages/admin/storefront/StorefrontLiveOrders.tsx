/**
 * Storefront Live Orders Page
 * Real-time order management with Kanban board view
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  RefreshCw,
  Search,
  Filter,
  Package,
  LayoutGrid,
  List,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StorefrontLiveOrdersKanban } from '@/components/admin/storefront/StorefrontLiveOrdersKanban';

interface LiveOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: any;
  delivery_notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_method: string;
  created_at: string;
  items: any[];
}

export default function StorefrontLiveOrders() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [previousOrderCount, setPreviousOrderCount] = useState<number>(0);

  // Fetch store
  const { data: store } = useQuery({
    queryKey: ['marketplace-store', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('marketplace_stores')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch live orders
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['storefront-live-orders', store?.id, statusFilter],
    queryFn: async () => {
      if (!store?.id) return [];

      let query = supabase
        .from('marketplace_orders')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      // Filter by active statuses if 'all', otherwise specific status
      if (statusFilter === 'all') {
        query = query.in('status', ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']);
      } else {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return (data || []) as unknown as LiveOrder[];
    },
    enabled: !!store?.id,
    refetchInterval: autoRefresh ? 10000 : false, // Auto-refresh every 10s
  });

  // Play sound on new order
  const playNewOrderSound = useCallback(() => {
    if (soundEnabled && typeof window !== 'undefined') {
      try {
        const audio = new Audio('/sounds/new-order.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Autoplay blocked, ignore
        });
      } catch (e) {
        // No sound file, ignore
      }
    }
  }, [soundEnabled]);

  // Detect new orders
  useEffect(() => {
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    if (pendingOrders > previousOrderCount && previousOrderCount > 0) {
      playNewOrderSound();
      toast({
        title: 'New Order!',
        description: `You have a new storefront order.`,
      });
    }
    setPreviousOrderCount(pendingOrders);
  }, [orders, previousOrderCount, playNewOrderSound, toast]);

  // Set up realtime subscription
  useEffect(() => {
    if (!store?.id) return;

    const channel = supabase
      .channel('storefront-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketplace_orders',
          filter: `store_id=eq.${store.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store?.id, refetch]);

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      if (!store?.id) throw new Error('No store context');

      const { error } = await supabase
        .from('marketplace_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('store_id', store.id);

      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['storefront-live-orders'] });
      toast({
        title: 'Order updated',
        description: `Status changed to ${formatStatus(newStatus)}`,
      });
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'StorefrontLiveOrders' });
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive',
      });
    },
  });

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ orderId, newStatus });
  };

  const handleViewDetails = (orderId: string) => {
    navigate(`/${tenantSlug}/admin/storefront-hub?tab=orders&order=${orderId}`);
  };

  // Filter orders by search
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query)
    );
  });

  // Stats
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const preparingCount = orders.filter(o => o.status === 'preparing' || o.status === 'confirmed').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;

  if (!store) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront-hub`)}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Live Orders
            {pendingCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingCount} new
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">
            {filteredOrders.length} active orders • {preparingCount} preparing • {readyCount} ready
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Sound Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          {/* View Toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Board
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>

          {/* Auto-refresh */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto
            </Label>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Active" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="preparing">Preparing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[400px] rounded-lg" />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-semibold">No active orders</p>
            <p className="text-sm text-muted-foreground mt-1">
              New orders will appear here in real-time
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <StorefrontLiveOrdersKanban
          orders={filteredOrders}
          onStatusChange={handleStatusChange}
          onViewDetails={handleViewDetails}
          isLoading={isLoading}
        />
      ) : (
        // List View (simplified)
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleViewDetails(order.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold">#{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_name || 'Guest'}</p>
                    </div>
                    <Badge variant="secondary">{order.items?.length || 0} items</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={
                      order.status === 'pending' ? 'bg-amber-500' :
                        order.status === 'preparing' ? 'bg-blue-500' :
                          order.status === 'ready' ? 'bg-green-500' :
                            order.status === 'out_for_delivery' ? 'bg-purple-500' :
                              'bg-gray-500'
                    }>
                      {formatStatus(order.status)}
                    </Badge>
                    <span className="font-semibold">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

