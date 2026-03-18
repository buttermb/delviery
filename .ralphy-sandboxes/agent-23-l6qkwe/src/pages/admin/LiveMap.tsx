import { logger } from '@/lib/logger';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  MapPin, Truck, Search,
  Phone, Navigation, Clock, Users, Activity,
  ChevronRight, RefreshCw, Maximize2, Minimize2, AlertCircle,
  CheckCircle, XCircle, Car, Focus
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cn } from '@/lib/utils';
import { AddCourierDialog } from '@/components/admin/AddCourierDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { formatCurrency, formatPhoneNumber } from '@/lib/formatters';
import { escapeHtml } from '@/lib/utils/sanitize';

interface CourierLocation {
  id: string;
  full_name: string;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  phone?: string;
  status?: string;
  last_updated?: string;
}

interface ActiveOrder {
  id: string;
  order_number: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  courier_id: string | null;
  eta_minutes: number | null;
  total_amount: number;
  created_at: string | null;
}

export default function LiveMap() {
  const { tenant } = useTenantAdminAuth();
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [allCouriers, setAllCouriers] = useState<CourierLocation[]>([]);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'dark'>('dark');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showRoutes] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showOffline, setShowOffline] = useState(false);
  useState<'couriers' | 'orders'>('couriers');
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const orderMarkers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const routeLayers = useRef<Set<string>>(new Set());
  const [mapLoaded, setMapLoaded] = useState(false);

  const { token: mapboxToken, loading: tokenLoading } = useMapboxToken();

  // Map style URLs
  const mapStyles = useMemo(() => ({
    streets: 'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    dark: 'mapbox://styles/mapbox/dark-v11'
  }), []);

  // Filter couriers based on search and online status
  const filteredCouriers = useMemo(() => {
    const list = showOffline ? allCouriers : couriers;
    if (!searchQuery) return list;
    return list.filter(c =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [couriers, allCouriers, searchQuery, showOffline]);

  // Stats
  const stats = useMemo(() => ({
    total: allCouriers.length,
    online: couriers.length,
    active: couriers.filter(c => c.status === 'delivering').length,
    offline: allCouriers.length - couriers.length,
  }), [couriers, allCouriers]);

  // Load couriers - memoized to prevent re-creation
  const loadCourierLocations = useCallback(async () => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // Load all couriers first (for total count)
      const { data: allData, error: allError } = await supabase
        .from('couriers')
        .select('id, full_name, is_online, current_lat, current_lng, phone')
        .eq('tenant_id', tenant.id);

      if (allError) {
        logger.error('Error loading all couriers', allError, { component: 'LiveMap' });
        throw allError;
      }

      setAllCouriers(allData ?? []);

      // Filter to online couriers with valid locations
      const onlineCouriers = (allData ?? []).filter(c =>
        c.is_online && c.current_lat !== null && c.current_lng !== null
      );

      setCouriers(onlineCouriers);
      setLastRefresh(new Date());

      if (allData && allData.length === 0) {
        logger.info('No couriers found for tenant', { tenantId: tenant.id, component: 'LiveMap' });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load courier locations';
      setError(errorMessage);
      logger.error('Error loading courier locations', err, { component: 'LiveMap' });
      toast.error('Failed to load courier locations', { description: humanizeError(err) });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  // Load active orders with delivery locations
  const loadActiveOrders = useCallback(async () => {
    if (!tenant?.id) {
      setOrdersLoading(false);
      return;
    }

    try {
      // Load orders that are in active delivery states
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, status, customer_name, customer_phone, delivery_address, dropoff_lat, dropoff_lng, pickup_lat, pickup_lng, courier_id, eta_minutes, total_amount, created_at')
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'assigned', 'out_for_delivery', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (ordersError) {
        logger.error('Error loading active orders', ordersError, { component: 'LiveMap' });
        return;
      }

      setActiveOrders(ordersData ?? []);
    } catch (err) {
      logger.error('Error loading active orders', err, { component: 'LiveMap' });
    } finally {
      setOrdersLoading(false);
    }
  }, [tenant?.id]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || map.current) return;

    try {
      mapboxgl.accessToken = mapboxToken;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyles[mapStyle],
        center: [-73.935242, 40.730610], // NYC center
        zoom: 12,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
      });

      // Add controls
      map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      map.current.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
      }), 'top-right');

      map.current.on('load', () => {
        setMapLoaded(true);

        // Add 3D buildings for immersive experience
        if (map.current) {
          const layers = map.current.getStyle().layers;
          const labelLayerId = layers?.find(
            (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
          )?.id;

          if (labelLayerId) {
            map.current.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 15,
                paint: {
                  'fill-extrusion-color': mapStyle === 'dark' ? '#1a1a2e' : '#aaa',
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'height'],
                  ],
                  'fill-extrusion-base': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'min_height'],
                  ],
                  'fill-extrusion-opacity': 0.6,
                },
              },
              labelLayerId
            );
          }

          // Add atmosphere effect for dark mode
          if (mapStyle === 'dark') {
            map.current.setFog({
              color: 'rgb(20, 20, 30)',
              'high-color': 'rgb(36, 36, 50)',
              'horizon-blend': 0.02,
              'space-color': 'rgb(11, 11, 25)',
              'star-intensity': 0.6
            });
          }
        }
      });

      map.current.on('error', (e) => {
        logger.error('Mapbox error', e.error, { component: 'LiveMap' });
      });

    } catch (err) {
      logger.error('Failed to initialize map', err, { component: 'LiveMap' });
      setError('Failed to initialize map');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapStyle and mapStyles are only needed at init time; style changes handled by separate effect
  }, [mapboxToken]);

  // Change map style
  useEffect(() => {
    if (map.current && mapLoaded) {
      map.current.setStyle(mapStyles[mapStyle]);
    }
  }, [mapStyle, mapLoaded, mapStyles]);

  // Load couriers and orders on mount and set up realtime subscriptions
  useEffect(() => {
    loadCourierLocations();
    loadActiveOrders();

    // Set up realtime subscription for couriers
    const couriersChannel = supabase
      .channel(`couriers-changes-${tenant?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couriers',
          filter: `tenant_id=eq.${tenant?.id}`,
        },
        () => {
          loadCourierLocations();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active', { component: 'LiveMap', table: 'couriers' });
        } else if (status === 'CHANNEL_ERROR') {
          logger.warn('Realtime subscription error, retrying', { component: 'LiveMap' });
          setTimeout(() => loadCourierLocations(), 5000);
        } else if (status === 'TIMED_OUT') {
          logger.error('Realtime subscription timed out', null, { component: 'LiveMap' });
          loadCourierLocations();
        }
      });

    // Set up realtime subscription for orders
    const ordersChannel = supabase
      .channel(`orders-map-changes-${tenant?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `tenant_id=eq.${tenant?.id}`,
        },
        () => {
          loadActiveOrders();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('Realtime subscription active', { component: 'LiveMap', table: 'orders' });
        }
      });

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      loadCourierLocations();
      loadActiveOrders();
    }, 30000);

    return () => {
      supabase.removeChannel(couriersChannel);
      supabase.removeChannel(ordersChannel);
      clearInterval(refreshInterval);
    };
  }, [loadCourierLocations, loadActiveOrders]);

  // Focus on a specific courier
  const focusOnCourier = (courier: CourierLocation) => {
    if (!courier.current_lat || !courier.current_lng) {
      toast.error('No location data available for this courier');
      return;
    }

    setSelectedCourier(courier.id);
    setSelectedOrder(null);
    if (map.current) {
      map.current.flyTo({
        center: [courier.current_lng, courier.current_lat],
        zoom: 16,
        pitch: 60,
        bearing: Math.random() * 360,
        duration: 2000,
        essential: true
      });

      // Open the popup for this marker
      const marker = markers.current[courier.id];
      if (marker) {
        marker.togglePopup();
      }
    }
  };

  // Get status color for orders
  const getOrderStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-yellow-500', text: 'text-yellow-600', hex: '#eab308' };
      case 'confirmed':
      case 'preparing':
        return { bg: 'bg-blue-500', text: 'text-blue-600', hex: '#3b82f6' };
      case 'ready_for_pickup':
        return { bg: 'bg-purple-500', text: 'text-purple-600', hex: '#a855f7' };
      case 'assigned':
      case 'out_for_delivery':
      case 'in_transit':
        return { bg: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' };
      default:
        return { bg: 'bg-gray-500', text: 'text-gray-600', hex: '#6b7280' };
    }
  }, []);

  // Get readable status label
  const getOrderStatusLabel = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'ready_for_pickup': return 'Ready';
      case 'assigned': return 'Assigned';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'in_transit': return 'In Transit';
      default: return status;
    }
  }, []);

  // Center map on all active couriers
  const centerOnActivity = useCallback(() => {
    if (!map.current || couriers.length === 0) {
      toast.info('No active couriers to center on');
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    couriers.forEach((courier) => {
      if (courier.current_lat && courier.current_lng) {
        bounds.extend([courier.current_lng, courier.current_lat]);
      }
    });

    if (!bounds.isEmpty()) {
      map.current.fitBounds(bounds, {
        padding: 100,
        maxZoom: 15,
        duration: 1500
      });
      setSelectedCourier(null);
      toast.success(`Centered on ${couriers.length} active courier${couriers.length > 1 ? 's' : ''}`);
    }
  }, [couriers]);

  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(() => {
    if (!mapContainer.current) return;

    if (!document.fullscreenElement) {
      mapContainer.current.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Update markers when couriers change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove markers that no longer exist
    Object.keys(markers.current).forEach((courierId) => {
      if (!couriers.find((c) => c.id === courierId)) {
        markers.current[courierId].remove();
        delete markers.current[courierId];
      }
    });

    // Add or update markers
    couriers.forEach((courier) => {
      if (!courier.current_lat || !courier.current_lng) return;

      if (markers.current[courier.id]) {
        // Update existing marker
        markers.current[courier.id].setLngLat([courier.current_lng, courier.current_lat]);
      } else {
        // Create new marker with enhanced styling
        const el = document.createElement('div');
        el.className = 'courier-marker';
        el.innerHTML = `
          <div class="relative group cursor-pointer">
            <div class="absolute inset-0 bg-emerald-500/30 rounded-full animate-ping"></div>
            <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-pulse scale-150"></div>
            <div class="relative bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg shadow-emerald-500/30 border-2 border-white/80 hover:scale-110 transition-all duration-300">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
              </svg>
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: 'courier-popup'
        }).setHTML(`
          <div class="p-4 min-w-[200px]">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
                ${escapeHtml(courier.full_name.charAt(0).toUpperCase())}
              </div>
              <div>
                <div class="font-semibold text-sm">${escapeHtml(courier.full_name)}</div>
                <div class="flex items-center gap-1">
                  <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="text-xs text-gray-500">Online</span>
                </div>
              </div>
            </div>
            <div class="space-y-2 text-xs text-gray-600 border-t pt-2">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span>${courier.current_lat?.toFixed(4)}, ${courier.current_lng?.toFixed(4)}</span>
              </div>
              ${courier.phone ? `
                <a href="tel:${escapeHtml(courier.phone)}" class="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  Call Driver
                </a>
              ` : ''}
            </div>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([courier.current_lng, courier.current_lat])
          .setPopup(popup)
          .addTo(map.current!);

        markers.current[courier.id] = marker;
      }
    });

    // Fit bounds to show all couriers
    if (couriers.length > 0 && !selectedCourier && !selectedOrder) {
      const bounds = new mapboxgl.LngLatBounds();
      couriers.forEach((courier) => {
        if (courier.current_lat && courier.current_lng) {
          bounds.extend([courier.current_lng, courier.current_lat]);
        }
      });
      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 100, maxZoom: 15 });
      }
    }
  }, [couriers, mapLoaded, selectedCourier, selectedOrder]);

  // Update order markers and routes when orders change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Remove order markers that no longer exist
    Object.keys(orderMarkers.current).forEach((orderId) => {
      if (!activeOrders.find((o) => o.id === orderId)) {
        orderMarkers.current[orderId].remove();
        delete orderMarkers.current[orderId];

        // Remove associated route
        const routeId = `route-${orderId}`;
        if (map.current!.getLayer(routeId)) {
          map.current!.removeLayer(routeId);
        }
        if (map.current!.getSource(routeId)) {
          map.current!.removeSource(routeId);
        }
        routeLayers.current.delete(routeId);
      }
    });

    // Add or update order markers
    activeOrders.forEach((order) => {
      if (!order.dropoff_lat || !order.dropoff_lng) return;

      const statusColor = getOrderStatusColor(order.status);
      const statusLabel = getOrderStatusLabel(order.status);

      if (orderMarkers.current[order.id]) {
        // Update existing marker position
        orderMarkers.current[order.id].setLngLat([order.dropoff_lng, order.dropoff_lat]);
      } else {
        // Create new customer/order marker
        const el = document.createElement('div');
        el.className = 'order-marker';
        el.innerHTML = `
          <div class="relative group cursor-pointer">
            <div class="absolute inset-0 rounded-full animate-pulse scale-125" style="background-color: ${statusColor.hex}20;"></div>
            <div class="relative rounded-full w-10 h-10 flex items-center justify-center shadow-lg border-2 border-white/80 hover:scale-110 transition-all duration-300" style="background: linear-gradient(135deg, ${statusColor.hex}, ${statusColor.hex}dd);">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: 'order-popup'
        }).setHTML(`
          <div class="p-4 min-w-[220px]">
            <div class="flex items-center justify-between mb-3">
              <div class="font-bold text-sm">#${escapeHtml(order.order_number || 'N/A')}</div>
              <span class="px-2 py-1 text-xs font-medium rounded-full" style="background-color: ${statusColor.hex}20; color: ${statusColor.hex};">
                ${statusLabel}
              </span>
            </div>
            <div class="space-y-2 text-xs text-gray-600">
              ${order.customer_name ? `
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <span class="font-medium">${escapeHtml(order.customer_name)}</span>
                </div>
              ` : ''}
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                </svg>
                <span class="line-clamp-2">${escapeHtml(order.delivery_address)}</span>
              </div>
              ${order.eta_minutes ? `
                <div class="flex items-center gap-2 text-emerald-600 font-medium">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span>ETA: ${order.eta_minutes} mins</span>
                </div>
              ` : ''}
              <div class="pt-2 border-t mt-2">
                <div class="font-semibold text-gray-900">${formatCurrency(order.total_amount)}</div>
              </div>
              ${order.customer_phone ? `
                <a href="tel:${escapeHtml(order.customer_phone)}" class="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium pt-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                  </svg>
                  Call Customer
                </a>
              ` : ''}
            </div>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([order.dropoff_lng, order.dropoff_lat])
          .setPopup(popup)
          .addTo(map.current!);

        orderMarkers.current[order.id] = marker;
      }

      // Draw route from courier to order destination if showRoutes is enabled and order has assigned courier
      if (showRoutes && order.courier_id) {
        const assignedCourier = couriers.find(c => c.id === order.courier_id);
        if (assignedCourier?.current_lat && assignedCourier?.current_lng && order.dropoff_lat && order.dropoff_lng) {
          const routeId = `route-${order.id}`;
          const routeData = {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: [
                [assignedCourier.current_lng, assignedCourier.current_lat],
                [order.dropoff_lng, order.dropoff_lat]
              ]
            }
          };

          if (map.current!.getSource(routeId)) {
            // Update existing route
            (map.current!.getSource(routeId) as mapboxgl.GeoJSONSource).setData(routeData);
          } else {
            // Create new route
            map.current!.addSource(routeId, {
              type: 'geojson',
              data: routeData
            });

            map.current!.addLayer({
              id: routeId,
              type: 'line',
              source: routeId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': statusColor.hex,
                'line-width': 3,
                'line-dasharray': [2, 2],
                'line-opacity': 0.8
              }
            });

            routeLayers.current.add(routeId);
          }
        }
      }
    });

    // Remove routes for orders that no longer have assigned couriers or routes disabled
    if (!showRoutes) {
      routeLayers.current.forEach((routeId) => {
        if (map.current!.getLayer(routeId)) {
          map.current!.removeLayer(routeId);
        }
        if (map.current!.getSource(routeId)) {
          map.current!.removeSource(routeId);
        }
      });
      routeLayers.current.clear();
    }
  }, [activeOrders, couriers, mapLoaded, showRoutes, getOrderStatusColor, getOrderStatusLabel]);

  // Toggle heatmap
  useEffect(() => {
    if (!map.current || !mapLoaded || couriers.length === 0) return;

    if (showHeatmap) {
      if (!map.current.getSource('couriers-heat')) {
        map.current.addSource('couriers-heat', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: couriers
              .filter(c => c.current_lat && c.current_lng)
              .map((courier) => ({
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'Point' as const,
                  coordinates: [courier.current_lng!, courier.current_lat!],
                },
              })),
          },
        });

        map.current.addLayer({
          id: 'couriers-heat-layer',
          type: 'heatmap',
          source: 'couriers-heat',
          paint: {
            'heatmap-weight': 1,
            'heatmap-intensity': 1,
            'heatmap-radius': 50,
            'heatmap-opacity': 0.7,
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(33,102,172,0)',
              0.2, 'rgb(103,169,207)',
              0.4, 'rgb(209,229,240)',
              0.6, 'rgb(253,219,199)',
              0.8, 'rgb(239,138,98)',
              1, 'rgb(178,24,43)'
            ]
          },
        });
      }
    } else {
      if (map.current.getLayer('couriers-heat-layer')) {
        map.current.removeLayer('couriers-heat-layer');
      }
      if (map.current.getSource('couriers-heat')) {
        map.current.removeSource('couriers-heat');
      }
    }
  }, [showHeatmap, couriers, mapLoaded]);

  // Toggle traffic layer
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (showTraffic) {
      // Add traffic layer if not already added
      if (!map.current.getSource('mapbox-traffic')) {
        map.current.addSource('mapbox-traffic', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1'
        });

        map.current.addLayer({
          id: 'traffic-layer',
          type: 'line',
          source: 'mapbox-traffic',
          'source-layer': 'traffic',
          paint: {
            'line-width': 2,
            'line-color': [
              'match',
              ['get', 'congestion'],
              'low', '#10b981',
              'moderate', '#f59e0b',
              'heavy', '#ef4444',
              'severe', '#dc2626',
              '#6b7280'
            ],
            'line-opacity': 0.8
          }
        });
      }
    } else {
      if (map.current.getLayer('traffic-layer')) {
        map.current.removeLayer('traffic-layer');
      }
      if (map.current.getSource('mapbox-traffic')) {
        map.current.removeSource('mapbox-traffic');
      }
    }
  }, [showTraffic, mapLoaded]);

  // No mapbox token
  if (!mapboxToken && !tokenLoading) {
    return (
      <>
        <SEOHead
          title="Live Map | Admin"
          description="Real-time courier tracking"
        />
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Navigation className="h-6 w-6 text-emerald-500" />
                Live Fleet Map
              </h1>
              <p className="text-sm text-muted-foreground">Real-time courier tracking</p>
            </div>
            <AddCourierDialog onSuccess={loadCourierLocations} />
          </div>

          <Card data-dark-panel className="p-8 bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                <MapPin className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Map Configuration Required</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                The Mapbox token needs to be configured to enable real-time fleet tracking.
                Please contact your administrator.
              </p>
            </div>
          </Card>

          {/* Still show courier list even without map */}
          <CourierList
            couriers={allCouriers}
            loading={loading}
            error={error}
            onRefresh={loadCourierLocations}
            stats={stats}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Live Map | Admin"
        description="Real-time courier tracking"
      />

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Navigation className="h-6 w-6 text-emerald-500" />
              Live Fleet Map
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Last updated: {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1 px-3 py-1 border-emerald-500/50 bg-emerald-500/10 text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {stats.online} Online
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadCourierLocations()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <AddCourierDialog onSuccess={loadCourierLocations} />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to load courier locations</p>
                <p className="text-sm opacity-80">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCourierLocations}
                className="ml-auto"
              >
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.total}</div>
                <div className="text-xs text-blue-600/70">Total Couriers</div>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.online}</div>
                <div className="text-xs text-emerald-600/70">Online Now</div>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.active}</div>
                <div className="text-xs text-amber-600/70">Delivering</div>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/20 border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-700 dark:text-gray-400">{stats.offline}</div>
                <div className="text-xs text-gray-600/70">Offline</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content - Map and Sidebar */}
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-4 order-2 lg:order-1">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search drivers"
                placeholder="Search drivers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Toggle offline */}
            <div className="flex items-center gap-2">
              <Button
                variant={showOffline ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowOffline(!showOffline)}
                className="w-full"
              >
                {showOffline ? 'Showing All' : 'Show Offline'}
              </Button>
            </div>

            {/* Courier List */}
            <Card className="max-h-[400px] overflow-y-auto">
              <CardContent className="p-2 space-y-2">
                {loading ? (
                  <EnhancedLoadingState variant="spinner" message="Loading drivers..." className="min-h-[200px]" />
                ) : filteredCouriers.length === 0 ? (
                  <EnhancedEmptyState
                    icon={Users}
                    title="No Couriers"
                    description="No couriers match your filters."
                    compact
                  />
                ) : (
                  filteredCouriers.map((courier) => (
                    <div
                      key={courier.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                        selectedCourier === courier.id && "border-emerald-500 bg-emerald-500/10",
                        !courier.is_online && "opacity-60"
                      )}
                      onClick={() => courier.is_online && courier.current_lat && focusOnCourier(courier)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm",
                          courier.is_online
                            ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                            : "bg-gray-400"
                        )}>
                          {courier.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" title={courier.full_name}>{courier.full_name}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              courier.is_online ? "bg-emerald-500" : "bg-gray-400"
                            )} />
                            {courier.is_online ? 'Online' : 'Offline'}
                            {!courier.current_lat && courier.is_online && (
                              <span className="text-amber-500 ml-1">• No GPS</span>
                            )}
                          </div>
                        </div>
                        {courier.is_online && courier.current_lat && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      {courier.phone && (
                        <a
                          href={`tel:${courier.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-700"
                        >
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(courier.phone)}
                        </a>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Map Container */}
          <Card className="overflow-hidden order-1 lg:order-2">
            {/* Map Controls */}
            <div className="p-3 border-b flex flex-wrap gap-2 bg-muted/30">
              <div className="flex gap-1">
                <Button
                  variant={mapStyle === 'dark' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMapStyle('dark')}
                >
                  Dark
                </Button>
                <Button
                  variant={mapStyle === 'streets' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMapStyle('streets')}
                >
                  Streets
                </Button>
                <Button
                  variant={mapStyle === 'satellite' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMapStyle('satellite')}
                >
                  Satellite
                </Button>
              </div>
              <Button
                variant={showHeatmap ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="gap-1"
              >
                <Activity className="h-4 w-4" />
                Heatmap
              </Button>
              <Button
                variant={showTraffic ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowTraffic(!showTraffic)}
                className="gap-1"
              >
                <Car className="h-4 w-4" />
                Traffic
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={centerOnActivity}
                className="gap-1"
                disabled={couriers.length === 0}
              >
                <Focus className="h-4 w-4" />
                Center
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="gap-1 ml-auto"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </Button>
            </div>

            {/* Map */}
            <div
              ref={mapContainer}
              className="w-full h-[500px]"
            />
          </Card>
        </div>
      </div>

      <style>{`
        .courier-marker {
          cursor: pointer;
        }
        
        .courier-popup .mapboxgl-popup-content {
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          border: 1px solid rgba(0,0,0,0.1);
        }
        
        .courier-popup .mapboxgl-popup-tip {
          border-top-color: white;
        }
        
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        .animate-ping {
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        
        .mapboxgl-ctrl-group {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
        
        .mapboxgl-ctrl-group button {
          border-radius: 6px !important;
        }
      `}</style>
    </>
  );
}

// Separate component for courier list (used when map is unavailable)
function CourierList({
  couriers,
  loading,
  error,
  onRefresh,
  stats
}: {
  couriers: CourierLocation[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  stats: { total: number; online: number; active: number; offline: number };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Couriers ({stats.total})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <EnhancedLoadingState variant="spinner" message="Loading drivers..." className="min-h-[200px]" />
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : couriers.length === 0 ? (
          <EnhancedEmptyState
            icon={Users}
            title="No Couriers"
            description="Use the 'Add Courier' button to register your first driver."
            compact
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {couriers.map((courier) => (
              <Card key={courier.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                    courier.is_online ? "bg-emerald-500" : "bg-gray-400"
                  )}>
                    {courier.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" title={courier.full_name}>{courier.full_name}</div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        courier.is_online ? "bg-emerald-500" : "bg-gray-400"
                      )} />
                      {courier.is_online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
                {courier.phone && (
                  <a
                    href={`tel:${courier.phone}`}
                    className="mt-2 flex items-center gap-2 text-xs text-emerald-600"
                  >
                    <Phone className="h-3 w-3" />
                    {formatPhoneNumber(courier.phone)}
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
