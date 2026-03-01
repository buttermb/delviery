import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMapboxToken } from '@/hooks/useMapboxToken';
import { themeColors } from '@/lib/utils/colorConversion';

interface OrderTrackingMapProps {
    order: {
        id: string;
        status: string;
        dropoff_lat?: number;
        dropoff_lng?: number;
        courier_id?: string;
        courier?: {
            full_name: string;
            current_lat?: number;
            current_lng?: number;
            vehicle_type?: string;
        };
    };
}

export function OrderTrackingMap({ order }: OrderTrackingMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const courierMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const { token, loading } = useMapboxToken();
    const [mapLoaded, setMapLoaded] = useState(false);

    useEffect(() => {
        if (!mapContainer.current || !token || loading) return;

        mapboxgl.accessToken = token;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [order.dropoff_lng || -73.935242, order.dropoff_lat || 40.730610],
            zoom: 13,
            pitch: 45,
        });

        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.current.on('load', () => {
            setMapLoaded(true);

            // Add delivery marker
            if (order.dropoff_lat && order.dropoff_lng) {
                const el = document.createElement('div');
                el.className = 'delivery-marker';
                el.innerHTML = `
          <div style="
            width: 40px;
            height: 40px;
            background: ${themeColors.primary()};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          ">
            🏠
          </div>
        `;

                new mapboxgl.Marker(el)
                    .setLngLat([order.dropoff_lng, order.dropoff_lat])
                    .addTo(map.current!);
            }
        });

        return () => {
            map.current?.remove();
        };
    }, [token, loading, order.dropoff_lat, order.dropoff_lng]);

    // Real-time courier updates
    useEffect(() => {
        if (!mapLoaded || !order.courier_id) return;

        // Initial courier marker
        if (order.courier?.current_lat && order.courier?.current_lng) {
            updateCourierMarker(order.courier.current_lat, order.courier.current_lng);
        }

        const channel = supabase
            .channel(`courier-${order.courier_id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'couriers',
                    filter: `id=eq.${order.courier_id}`
                },
                (payload) => {
                    if (payload.new.current_lat && payload.new.current_lng) {
                        updateCourierMarker(payload.new.current_lat, payload.new.current_lng);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- courier lat/lng are for initial placement; updates come via realtime subscription. updateCourierMarker uses refs
    }, [mapLoaded, order.courier_id]);

    const updateCourierMarker = (lat: number, lng: number) => {
        if (!map.current) return;

        if (!courierMarkerRef.current) {
            const el = document.createElement('div');
            el.innerHTML = `
        <div style="
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, ${themeColors.success()}, ${themeColors.primary()});
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          animation: float 3s ease-in-out infinite;
        ">
          🚗
        </div>
      `;

            courierMarkerRef.current = new mapboxgl.Marker(el)
                .setLngLat([lng, lat])
                .addTo(map.current);

            // Fit bounds to show both markers
            if (order.dropoff_lat && order.dropoff_lng) {
                const bounds = new mapboxgl.LngLatBounds()
                    .extend([lng, lat])
                    .extend([order.dropoff_lng, order.dropoff_lat]);

                map.current.fitBounds(bounds, { padding: 100 });
            }
        } else {
            courierMarkerRef.current.setLngLat([lng, lat]);
        }
    };

    if (loading) return <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-xl" />;

    if (!token) {
        return (
            <Card className="overflow-hidden bg-gray-50 border-dashed">
                <div className="p-8 text-center text-gray-500">
                    <Navigation className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Live tracking map unavailable</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden border-0 shadow-lg rounded-xl">
            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
            <div ref={mapContainer} className="h-[400px] w-full" />
        </Card>
    );
}
