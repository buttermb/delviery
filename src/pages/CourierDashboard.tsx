import { useEffect, useState, useRef } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { useCourierPin } from '@/contexts/CourierPinContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, MapPin, Phone, Navigation, Clock, CheckCircle, 
  DollarSign, Package, User, Camera, AlertCircle, Circle, Star, LogOut, Menu, Bell 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import PinSetupModal from '@/components/courier/PinSetupModal';
import PinUnlockModal from '@/components/courier/PinUnlockModal';
import LocationPermissionModal from '@/components/courier/LocationPermissionModal';
import TutorialModal from '@/components/courier/TutorialModal';
import NotificationPermissionBanner from '@/components/courier/NotificationPermissionBanner';
import OrderCountdownTimer from '@/components/courier/OrderCountdownTimer';
import AgeVerificationScanner from '@/components/courier/AgeVerificationScanner';
import { GeofenceStatus } from '@/components/courier/GeofenceStatus';
import InstallPWA from '@/components/InstallPWA';
import OnlineStatusCard from '@/components/courier/OnlineStatusCard';
import QuickStatsCard from '@/components/courier/QuickStatsCard';
import AvailableOrdersCard from '@/components/courier/AvailableOrdersCard';
import DeliveryNotificationModal from '@/components/courier/DeliveryNotificationModal';
import DailyGoalsTracker from '@/components/courier/DailyGoalsTracker';
import QuickActionsMenu from '@/components/courier/QuickActionsMenu';
import EnhancedStats from '@/components/courier/EnhancedStats';
import TodayEarningSummary from '@/components/courier/TodayEarningSummary';
import DeviceStatusBar from '@/components/courier/DeviceStatusBar';
import ShiftTimer from '@/components/courier/ShiftTimer';
import EnhancedOrderCard from '@/components/courier/EnhancedOrderCard';
import CourierKeyboardShortcuts from '@/components/courier/CourierKeyboardShortcuts';
import CourierPerformanceTracker from '@/components/courier/CourierPerformanceTracker';
import { useEnhancedAudio } from '@/hooks/useEnhancedAudio';
import { 
  requestNotificationPermission, 
  notifyNewOrder, 
  notifyEarningsUpdate,
  playOrderSound,
  vibrateDevice 
} from '@/utils/courierNotifications';
import { checkGeofence, calculateDistance } from '@/utils/geofenceHelper';

interface OrderItem {
  product_name: string;
  quantity: number;
  products?: {
    name: string;
    thca_percentage?: number;
  };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  delivery_address: string;
  delivery_borough: string;
  tip_amount?: number;
  special_instructions?: string;
  customer_name?: string;
  customer_phone?: string;
  accepted_at?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  delivered_at?: string;
  addresses?: {
    street: string;
    apartment?: string;
    zip_code: string;
  };
  merchants?: {
    business_name: string;
    address: string;
  };
  order_items?: OrderItem[];
}

interface TodayStats {
  deliveries_completed: number;
  total_earned: string;
  tips_earned?: string;
}

export default function CourierDashboard() {
  const { courier, loading: courierLoading, isOnline, toggleOnlineStatus } = useCourier();
  const { hasPinSetup, isUnlocked, setupPin, verifyPin } = useCourierPin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [currentView, setCurrentView] = useState<'active' | 'available' | 'completed' | 'earnings'>('active');
  const [orderStatus, setOrderStatus] = useState<'pickup' | 'delivering' | 'arrived' | 'verifying'>('pickup');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [distanceToCustomer, setDistanceToCustomer] = useState<number | null>(null);
  const [geofenceCheckInterval, setGeofenceCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const previousOrderCountRef = useRef(0);
  const audio = useEnhancedAudio();

  // Check for first-time user and location permission
  useEffect(() => {
    if (courier && isUnlocked) {
      // Check if first time user
      const hasSeenTutorial = localStorage.getItem('courier_tutorial_completed');
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }

      // Check location permission
      checkLocationPermission();
      
      // Request notification permission
      requestNotificationPermission().then(granted => {
        setNotificationsEnabled(granted);
      });
    }
  }, [courier, isUnlocked]);

  // Real-time subscription for new orders - Enhanced with multiple triggers
  useEffect(() => {
    if (!courier || !isOnline) return;

    const channel = supabase
      .channel('new-orders-enhanced')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `status=eq.pending`
        },
        (payload) => {
          console.log('🆕 New order detected (INSERT):', payload);
          const newOrder = payload.new as any;
          
          // Play enhanced sound and vibrate
          audio.playNewOrderSound();
          vibrateDevice([200, 100, 200, 100, 200]);
          
          // Show notification
          if (notificationsEnabled) {
            notifyNewOrder(
              newOrder.order_number,
              newOrder.total_amount,
              newOrder.delivery_borough
            );
          }
          
          // Show toast
          toast.success('🚨 New Order Available!', {
            description: `${newOrder.order_number} - $${newOrder.total_amount}`,
            duration: 5000
          });
          
          // Immediately refetch available orders
          queryClient.invalidateQueries({ queryKey: ['courier-available-orders'] });
          setTimeout(() => {
            queryClient.refetchQueries({ queryKey: ['courier-available-orders'] });
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `status=eq.pending`
        },
        (payload) => {
          console.log('🔄 Order updated to pending:', payload);
          // Also refetch when an order becomes pending again
          queryClient.invalidateQueries({ queryKey: ['courier-available-orders'] });
          setTimeout(() => {
            queryClient.refetchQueries({ queryKey: ['courier-available-orders'] });
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courier, isOnline, notificationsEnabled, queryClient]);

  // Listen for admin PIN changes - force re-verification when admin updates PIN
  useEffect(() => {
    if (!courier?.id) return;

    const channel = supabase
      .channel('courier-pin-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers',
          filter: `id=eq.${courier.id}`
        },
        (payload) => {
          // Check if admin_pin or admin_pin_verified was updated
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          if (newRecord.admin_pin !== oldRecord.admin_pin || 
              (newRecord.admin_pin_verified === false && oldRecord.admin_pin_verified === true)) {
            toast.info('Admin has updated your PIN. Please sign in again with the new PIN.');
            // Sign out the courier to force re-login with new PIN
            setTimeout(async () => {
              await supabase.auth.signOut();
              navigate('/courier/login');
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courier?.id, navigate]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showMenu && !target.closest('.menu-container')) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const checkLocationPermission = async () => {
    if ('geolocation' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') {
          setLocationPermissionGranted(true);
        } else if (result.state === 'prompt') {
          setShowLocationModal(true);
        } else {
          setShowLocationModal(true);
        }
      } catch (error) {
        // Fallback for browsers that don't support permissions API
        navigator.geolocation.getCurrentPosition(
          () => setLocationPermissionGranted(true),
          () => setShowLocationModal(true)
        );
      }
    }
  };

  const requestLocationPermission = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationPermissionGranted(true);
          setShowLocationModal(false);
          toast.success('Location access granted!');
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('Please enable location in your browser settings');
          } else {
            toast.error('Unable to access location');
          }
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleTutorialComplete = () => {
    localStorage.setItem('courier_tutorial_completed', 'true');
    setShowTutorial(false);
    if (!locationPermissionGranted) {
      setShowLocationModal(true);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/courier/login');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Error logging out');
    }
  };

  const handleToggleOnline = async () => {
    if (!locationPermissionGranted && !isOnline) {
      setShowLocationModal(true);
      return;
    }
    await toggleOnlineStatus();
  };

  // Fetch today's stats
  const { data: stats } = useQuery<TodayStats>({
    queryKey: ['courier-today-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { endpoint: 'today-stats' }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
    enabled: !!courier
  });

  // Fetch active orders
  const { data: myOrdersData, refetch: refetchMyOrders } = useQuery({
    queryKey: ['courier-my-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { endpoint: 'my-orders', status: 'active' }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
    enabled: !!courier
  });

  // Realtime subscription for my orders updates
  useEffect(() => {
    if (!courier) return;

    const channel = supabase
      .channel('my-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order updated:', payload);
          refetchMyOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courier, refetchMyOrders]);

  // Fetch available orders - faster refresh for quicker updates
  const { data: availableOrdersData } = useQuery({
    queryKey: ['courier-available-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { endpoint: 'available-orders' }
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000, // Check every 3 seconds instead of 15
    enabled: !!courier && isOnline,
    refetchOnWindowFocus: true, // Also refetch when tab becomes active
    refetchOnMount: true // Refetch on component mount
  });

  // Fetch completed orders
  const { data: completedOrdersData } = useQuery({
    queryKey: ['courier-completed-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { endpoint: 'my-orders', status: 'delivered' }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!courier && currentView === 'completed'
  });

  // Accept order mutation
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('courier-app', {
        body: { endpoint: 'accept-order', order_id: orderId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      audio.playSuccessSound();
      toast.success('Order accepted!');
      queryClient.invalidateQueries({ queryKey: ['courier-my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['courier-available-orders'] });
      setCurrentView('active');
    },
    onError: () => {
      toast.error("Order no longer available");
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() })
        })
        .eq('id', orderId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: async (_, variables) => {
      const messages: Record<string, string> = {
        'out_for_delivery': '🚗 Order picked up - en route!',
        'delivered': '🎉 Delivery completed!',
      };
      
      toast.success(messages[variables.newStatus] || "Status updated");
      
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['courier-my-orders'] }),
        queryClient.refetchQueries({ queryKey: ['courier-today-stats'] })
      ]);
      
      if (variables.newStatus === 'delivered') {
        audio.playEarningsSound();
        setOrderStatus('pickup');
        setCurrentView('completed');
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Error updating status");
    }
  });

  // Track new order count - Must come AFTER availableOrdersData is declared
  useEffect(() => {
    const currentCount = availableOrdersData?.orders?.length || 0;
    const previousCount = previousOrderCountRef.current;
    
    if (currentCount > previousCount && previousCount > 0) {
      const newOrders = currentCount - previousCount;
      setNewOrderCount(prev => prev + newOrders);
      
      // Clear badge after 10 seconds
      setTimeout(() => {
        setNewOrderCount(0);
      }, 10000);
    }
    
    previousOrderCountRef.current = currentCount;
  }, [availableOrdersData]);


  // Open navigation
  const openNavigation = (order: Order, destination: 'pickup' | 'delivery') => {
    const lat = destination === 'pickup' ? order.pickup_lat : order.dropoff_lat;
    const lng = destination === 'pickup' ? order.pickup_lng : order.dropoff_lng;
    
    if (!lat || !lng) {
      toast.error('Location not available');
      return;
    }
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    
    window.open(url, '_blank');
  };

  // Compute derived values (safe to do before early returns)
  const myOrders = myOrdersData?.orders || [];
  const availableOrders = availableOrdersData?.orders || [];
  const completedOrders = completedOrdersData?.orders || [];
  const activeOrder = myOrders[0];

  const todayEarnings = parseFloat(stats?.total_earned || '0');
  const todayTips = parseFloat(stats?.tips_earned || '0');
  const todayDeliveries = stats?.deliveries_completed || 0;

  // Geofence tracking for active order - MUST be before early returns
  useEffect(() => {
    if (!activeOrder || !courier || !locationPermissionGranted) {
      if (geofenceCheckInterval) {
        clearInterval(geofenceCheckInterval);
        setGeofenceCheckInterval(null);
      }
      setDistanceToCustomer(null);
      return;
    }

    // Update location and check geofence every 10 seconds
    const updateGeofence = async () => {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
        });

        const driverLat = position.coords.latitude;
        const driverLng = position.coords.longitude;

        // Calculate distance locally for immediate UI update
        if (activeOrder.dropoff_lat && activeOrder.dropoff_lng) {
          const distance = calculateDistance(
            driverLat,
            driverLng,
            activeOrder.dropoff_lat,
            activeOrder.dropoff_lng
          );
          setDistanceToCustomer(distance);
        }

        // Send to backend for geofence check and logging
        await checkGeofence(activeOrder.id, driverLat, driverLng, 'location_update');

      } catch (error) {
        console.error('Geofence update error:', error);
      }
    };

    // Initial check
    updateGeofence();

    // Set up interval
    const interval = setInterval(updateGeofence, 10000);
    setGeofenceCheckInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeOrder, courier, locationPermissionGranted]);

  // Early returns AFTER all hooks
  if (courierLoading || !courier) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPinSetup) {
    return (
      <div className="min-h-screen bg-background">
        <PinSetupModal open={true} onPinSet={setupPin} />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-background">
        <PinUnlockModal open={true} onUnlock={verifyPin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white pb-20 pb-safe">
      {/* Modals */}
      <TutorialModal open={showTutorial} onComplete={handleTutorialComplete} />
      
      {/* Age Verification Scanner */}
      <AgeVerificationScanner
        open={showAgeVerification}
        onClose={() => setShowAgeVerification(false)}
        onVerified={(isOver21, ageData) => {
          console.log('Age verification:', { isOver21, ageData });
          setShowAgeVerification(false);
          
          if (isOver21) {
            toast.success('Age verified - Continue to complete delivery');
            setOrderStatus('pickup'); // Reset for next delivery
            if (activeOrder) {
              updateStatusMutation.mutate({ orderId: activeOrder.id, newStatus: 'delivered' });
            }
          } else {
            // Handle underage rejection - customer is under 21
            toast.error('Customer under 21 - Cannot complete delivery', {
              description: 'Order must be returned to store',
              duration: 5000
            });
            
            // Update order status to reflect rejection
            if (activeOrder) {
              updateStatusMutation.mutate({ 
                orderId: activeOrder.id, 
                newStatus: 'pending' // Return order to pending for reassignment
              });
            }
            
            // Reset courier state
            setOrderStatus('pickup');
            setShowAgeVerification(false);
          }
        }}
      />
      
      {/* Notification Permission Banner */}
      {isOnline && <NotificationPermissionBanner />}

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-4 sticky top-0 z-50 pt-safe">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
              <span className="text-slate-900 font-black text-sm">NYM</span>
            </div>
            <div>
              <div className="font-black text-sm">DRIVER PANEL</div>
              <div className="flex items-center space-x-2 text-xs">
                <Switch 
                  checked={isOnline} 
                  onCheckedChange={handleToggleOnline}
                  className="scale-75"
                />
                <span className={isOnline ? 'text-teal-400 font-bold' : 'text-slate-400'}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <DeviceStatusBar />
            <div className="text-right">
              <div className="text-2xl font-black text-teal-400">${todayEarnings.toFixed(2)}</div>
              <div className="text-xs text-slate-400">Your Earnings Today</div>
            </div>
            <div className="menu-container relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 transition border border-slate-700 touch-manipulation active:scale-95"
              >
                <Menu size={20} />
              </button>
              
              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 top-12 bg-slate-800 border border-slate-700 rounded shadow-lg overflow-hidden z-50 min-w-[200px]">
                  <button
                    onClick={() => {
                      setShowTutorial(true);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-700 transition flex items-center space-x-2 border-b border-slate-700 touch-manipulation active:scale-95"
                  >
                    <AlertCircle size={18} />
                    <span>View Tutorial</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left hover:bg-slate-700 transition flex items-center space-x-2 text-red-400 touch-manipulation active:scale-95"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-slate-800 border-b border-slate-700 px-2 py-2 flex space-x-2 overflow-x-auto">
        {[
          { id: 'active' as const, label: 'Active', icon: Package, count: myOrders.length },
          { id: 'available' as const, label: 'Available', icon: Circle, count: newOrderCount },
          { id: 'completed' as const, label: 'Completed', icon: CheckCircle },
          { id: 'earnings' as const, label: 'Earnings', icon: DollarSign }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setCurrentView(tab.id);
                if (tab.id === 'available') {
                  setNewOrderCount(0);
                }
              }}
              className={`relative flex items-center space-x-2 px-4 py-2 font-bold text-sm transition whitespace-nowrap ${
                currentView === tab.id 
                  ? 'bg-teal-500 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white border-0 animate-pulse">
                  {tab.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Order View */}
      {currentView === 'active' && (
        <div className="p-4 space-y-4">
          {!activeOrder ? (
            <>
              {/* Enhanced Online Status Card */}
              {courier && (
                <OnlineStatusCard
                  courierId={courier.id}
                  isOnline={isOnline}
                  onStatusChange={handleToggleOnline}
                />
              )}

              {/* Quick Stats */}
              {stats && (
                <QuickStatsCard
                  todayDeliveries={stats.deliveries_completed || 0}
                  todayEarnings={parseFloat(stats.total_earned || '0')}
                  avgDeliveryTime={25}
                  completionRate={100}
                />
              )}

              {/* No Active Order Message */}
              <div className="text-center text-slate-400 py-12">
                <Package size={48} className="mx-auto mb-4 opacity-50" />
                <div>No active orders</div>
                <div className="text-sm mt-2">Check "Available" tab for new orders</div>
              </div>
            </>
          ) : (
            <>
              {/* Status Progress */}
              <div className="bg-slate-800 border border-slate-700 p-6">
                <div className="flex justify-between mb-4">
                  {[
                    { label: 'Pickup', status: 'pickup' as const, done: orderStatus !== 'pickup' },
                    { label: 'Delivering', status: 'delivering' as const, done: ['arrived', 'verifying'].includes(orderStatus) },
                    { label: 'Arrived', status: 'arrived' as const, done: orderStatus === 'verifying' },
                    { label: 'Verify ID', status: 'verifying' as const, done: false }
                  ].map((step, idx) => (
                    <div key={step.status} className="flex-1 text-center">
                      <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2 ${
                        orderStatus === step.status ? 'bg-teal-500' : 
                        step.done ? 'bg-teal-600' : 'bg-slate-700'
                      }`}>
                        {step.done ? <CheckCircle size={20} /> : idx + 1}
                      </div>
                      <div className="text-xs font-bold">{step.label}</div>
                    </div>
                  ))}
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-500 transition-all duration-500"
                    style={{ 
                      width: orderStatus === 'pickup' ? '25%' : 
                             orderStatus === 'delivering' ? '50%' : 
                             orderStatus === 'arrived' ? '75%' : '100%' 
                    }}
                  ></div>
                </div>
              </div>

              {/* Order Info Card */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-teal-500/30 p-6">
                {/* Courier Earnings Display - Prominent */}
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4 mb-4">
                  <div className="text-xs text-teal-400 font-bold mb-1">YOUR EARNINGS</div>
                  <div className="text-4xl font-black text-teal-400 mb-2">
                    ${((activeOrder.total_amount || 0) * 0.30 + (activeOrder.tip_amount || 0)).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400">
                    Base: ${((activeOrder.total_amount || 0) * 0.30).toFixed(2)}
                    {activeOrder.tip_amount && activeOrder.tip_amount > 0 && ` | Tip: $${activeOrder.tip_amount.toFixed(2)}`}
                  </div>
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="text-xs text-teal-400 font-bold mb-1">ORDER ID</div>
                    <div className="text-2xl font-black">{activeOrder.order_number}</div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {activeOrder.accepted_at && (
                      <OrderCountdownTimer 
                        orderNumber={activeOrder.order_number}
                        acceptedAt={activeOrder.accepted_at}
                      />
                    )}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-slate-900/50 border border-slate-700 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                        <User size={20} />
                      </div>
                      <div>
                        <div className="font-bold">{activeOrder.customer_name || 'Customer'}</div>
                        <div className="text-sm text-slate-400">Customer</div>
                      </div>
                    </div>
                    {activeOrder.customer_phone && (
                      <a 
                        href={`tel:${activeOrder.customer_phone}`}
                        className="bg-slate-800 hover:bg-slate-700 w-10 h-10 flex items-center justify-center transition border border-slate-600"
                      >
                        <Phone size={18} />
                      </a>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <MapPin className="text-teal-400 flex-shrink-0 mt-1" size={16} />
                      <div>
                        <div className="font-bold text-sm">{activeOrder.delivery_address}</div>
                        {activeOrder.addresses?.apartment && (
                          <div className="text-xs text-slate-400">{activeOrder.addresses.apartment}</div>
                        )}
                      </div>
                    </div>
                    {activeOrder.special_instructions && (
                      <div className="bg-slate-800 border border-slate-700 p-3 text-sm">
                        <div className="text-xs text-teal-400 font-bold mb-1">INSTRUCTIONS</div>
                        {activeOrder.special_instructions}
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="bg-slate-900/50 border border-slate-700 p-4 mb-4">
                  <div className="text-xs text-teal-400 font-bold mb-3">ORDER ITEMS</div>
                  {activeOrder.order_items?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                      <div>
                        <div className="font-bold text-sm">{item.products?.name || item.product_name}</div>
                        {item.products?.thca_percentage && (
                          <div className="text-xs text-slate-400">{item.products.thca_percentage}%</div>
                        )}
                      </div>
                      <div className="text-sm font-bold">x{item.quantity}</div>
                    </div>
                  ))}
                </div>

                {/* Geofence Status */}
                {orderStatus === 'delivering' && (
                  <div className="mb-4">
                    <GeofenceStatus 
                      distance={distanceToCustomer}
                      customerAddress={activeOrder.delivery_address}
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {orderStatus === 'pickup' && (
                    <>
                      <button 
                        onClick={() => openNavigation(activeOrder, 'pickup')}
                        className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 py-4 font-black text-lg transition flex items-center justify-center space-x-2"
                      >
                        <Navigation size={20} />
                        <span>NAVIGATE TO STORE</span>
                      </button>
                      <button 
                        onClick={() => setOrderStatus('delivering')}
                        className="w-full bg-slate-700 hover:bg-slate-600 py-3 font-bold transition"
                      >
                        Picked Up Order
                      </button>
                    </>
                  )}

                  {orderStatus === 'delivering' && (
                    <>
                      <button 
                        onClick={() => openNavigation(activeOrder, 'delivery')}
                        className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 py-4 font-black text-lg transition flex items-center justify-center space-x-2"
                      >
                        <Navigation size={20} />
                        <span>NAVIGATE TO CUSTOMER</span>
                      </button>
                      <button 
                        onClick={() => setOrderStatus('arrived')}
                        className="w-full bg-slate-700 hover:bg-slate-600 py-3 font-bold transition"
                      >
                        I've Arrived
                      </button>
                    </>
                  )}

                  {orderStatus === 'arrived' && (
                    <>
                      <button 
                        onClick={() => {
                          if (distanceToCustomer !== null && distanceToCustomer > 0.5) {
                            toast.error(`You're ${distanceToCustomer.toFixed(2)} miles away. Get within 0.5 miles to complete delivery.`);
                            return;
                          }
                          setShowAgeVerification(true);
                        }}
                        disabled={distanceToCustomer !== null && distanceToCustomer > 0.5}
                        className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 py-4 font-black text-lg transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <AlertCircle size={20} />
                        <span>VERIFY CUSTOMER ID (21+)</span>
                      </button>
                      {distanceToCustomer !== null && distanceToCustomer > 0.5 && (
                        <div className="bg-red-500/10 border border-red-500/30 p-3 text-sm text-center">
                          <div className="font-bold text-red-500 mb-1">❌ NOT IN DELIVERY RANGE</div>
                          Get within 0.5 miles to complete delivery
                        </div>
                      )}
                      <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 text-sm text-center">
                        <div className="font-bold text-yellow-500 mb-1">⚠️ REQUIRED BY LAW</div>
                        Must verify customer is 21+ before delivery
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Available Orders View */}
      {currentView === 'available' && (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-slate-400">
              {availableOrders.length} orders available nearby
            </div>
            {isOnline && (
              <div className="flex items-center space-x-2 text-xs text-teal-400">
                <Bell size={14} className="animate-pulse" />
                <span>Notifications Active</span>
              </div>
            )}
          </div>
          {availableOrders.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              <Circle size={48} className="mx-auto mb-4 opacity-50" />
              <div>No available orders</div>
            </div>
          ) : (
            availableOrders.map((order: Order) => {
              const baseCommission = (order.total_amount || 0) * 0.30;
              const tipAmount = order.tip_amount || 0;
              const courierEarnings = baseCommission + tipAmount;
              
              return (
                <div key={order.id} className="bg-slate-800 border border-slate-700 hover:border-teal-500 p-6 transition">
                  {/* Prominent Earnings Display */}
                  <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-4 mb-4">
                    <div className="text-xs text-green-400 font-bold mb-1">YOUR EARNINGS</div>
                    <div className="text-4xl font-black text-green-400">
                      ${courierEarnings.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Base: ${baseCommission.toFixed(2)} {tipAmount > 0 && `| Tip: $${tipAmount.toFixed(2)}`}
                    </div>
                  </div>

                  {/* ORDER ITEMS - Show what to deliver */}
                  {order.order_items && order.order_items.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <Package className="text-blue-400" size={16} />
                        <div className="text-xs text-blue-400 font-bold">ITEMS TO DELIVER ({order.order_items.length})</div>
                      </div>
                      <div className="space-y-2">
                        {order.order_items.map((item: OrderItem, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-900/50 border border-slate-700 p-3 rounded">
                            <div>
                              <div className="font-bold text-sm">{item.products?.name || item.product_name}</div>
                              {item.products?.thca_percentage && (
                                <div className="text-xs text-slate-400">{item.products.thca_percentage}%</div>
                              )}
                            </div>
                            <div className="text-sm font-bold text-slate-300">x{item.quantity}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xl font-black mb-1">{order.order_number}</div>
                      <div className="text-sm text-slate-400">
                        {order.delivery_borough}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-start space-x-2">
                      <MapPin className="text-teal-400 flex-shrink-0 mt-1" size={14} />
                      <div className="text-sm text-slate-300">{order.delivery_address}</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => acceptOrderMutation.mutate(order.id)}
                    disabled={acceptOrderMutation.isPending}
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 py-3 font-black transition"
                  >
                    ACCEPT ORDER
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Completed Orders View */}
      {currentView === 'completed' && (
        <div className="p-4 space-y-3">
          <div className="text-sm text-slate-400 mb-4">
            {completedOrders.length} deliveries completed today
          </div>
          {completedOrders.map((order: Order) => {
            const courierEarnings = (order.total_amount || 0) * 0.30 + (order.tip_amount || 0);
            return (
              <div key={order.id} className="bg-slate-800 border border-slate-700 p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold">{order.order_number}</div>
                  <div className="text-sm text-slate-400">{order.delivery_borough}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-teal-400">${courierEarnings.toFixed(2)}</div>
                  <div className="text-xs text-slate-500">Your earnings</div>
                  <div className="flex items-center space-x-1 text-yellow-500 mt-1">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs">5.0</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Earnings View */}
      {currentView === 'earnings' && (
        <div className="p-4 space-y-4">
          <CourierPerformanceTracker />
          
          <TodayEarningSummary
            earnings={todayEarnings}
            commission={todayEarnings * 0.15}
            tips={parseFloat(stats?.tips_earned || '0')}
            bonuses={0}
            deliveries={stats?.deliveries_completed || 0}
            hoursWorked={5}
            dailyGoal={100}
          />

          <button className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 py-4 font-black text-lg transition">
            CASH OUT NOW
          </button>
        </div>
      )}

      {/* Delivery Notification Modal - Always Rendered */}
      <DeliveryNotificationModal />
      
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <button 
            onClick={() => setCurrentView('active')}
            className="flex flex-col items-center space-y-1"
          >
            <Package size={20} className={currentView === 'active' ? 'text-teal-400' : 'text-slate-400'} />
            <span className={`text-xs font-bold ${currentView === 'active' ? 'text-teal-400' : 'text-slate-400'}`}>Orders</span>
          </button>
          <button 
            onClick={() => setCurrentView('earnings')}
            className="flex flex-col items-center space-y-1"
          >
            <DollarSign size={20} className={currentView === 'earnings' ? 'text-teal-400' : 'text-slate-400'} />
            <span className={`text-xs font-bold ${currentView === 'earnings' ? 'text-teal-400' : 'text-slate-400'}`}>Earnings</span>
          </button>
          <button 
            onClick={() => navigate('/courier/profile')}
            className="flex flex-col items-center space-y-1"
          >
            <User size={20} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-400">Profile</span>
          </button>
        </div>
      </div>

      <InstallPWA />
      
      {/* Keyboard Shortcuts */}
      <CourierKeyboardShortcuts
        hasActiveOrder={!!activeOrder}
        hasPendingOrder={availableOrders.length > 0}
        onAcceptOrder={() => availableOrders[0] && acceptOrderMutation.mutate(availableOrders[0].id)}
        onToggleOnline={handleToggleOnline}
        onViewEarnings={() => setCurrentView('earnings')}
        onNavigate={() => activeOrder && openNavigation(activeOrder, 'delivery')}
      />
    </div>
  );
}
