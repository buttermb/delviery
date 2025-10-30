import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ETAData {
  eta_minutes: number;
  distance_miles: number;
  last_updated: string;
  route?: any;
}

export const useETATracking = (orderId: string | null) => {
  const [eta, setEta] = useState<ETAData | null>(null);
  const [loading, setLoading] = useState(false);

  const calculateETA = async (courierLat?: number, courierLng?: number) => {
    if (!orderId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-eta', {
        body: {
          orderId,
          courierLat: courierLat || null,
          courierLng: courierLng || null
        }
      });

      if (error) throw error;

      setEta({
        eta_minutes: data.eta_minutes,
        distance_miles: parseFloat(data.distance_miles),
        last_updated: new Date().toISOString(),
        route: data.route
      });
    } catch (error) {
      console.error('ETA calculation error:', error);
      // Fallback: try to use existing order ETA from DB, otherwise provide a safe default
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('eta_minutes, eta_updated_at, distance_miles')
          .eq('id', orderId)
          .maybeSingle();

        const fallbackEta = Math.max(15, Number(order?.eta_minutes) || 20);
        const fallbackDistance = Number(order?.distance_miles) || 0;

        setEta({
          eta_minutes: fallbackEta,
          distance_miles: fallbackDistance,
          last_updated: order?.eta_updated_at || new Date().toISOString(),
          route: null,
        });
      } catch (fallbackErr) {
        console.warn('ETA fallback failed, using default:', fallbackErr);
        setEta({
          eta_minutes: 20,
          distance_miles: 0,
          last_updated: new Date().toISOString(),
          route: null,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;

    // Subscribe to courier location updates for this order
    const channel = supabase
      .channel(`eta-tracking-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.eta_minutes) {
            setEta(prev => ({
              ...prev,
              eta_minutes: updated.eta_minutes,
              last_updated: updated.eta_updated_at || new Date().toISOString()
            } as ETAData));
          }
        }
      )
      .subscribe();

    // Initial ETA calculation
    calculateETA();

    // Recalculate every 2 minutes
    const interval = setInterval(() => calculateETA(), 120000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [orderId]);

  return {
    eta,
    loading,
    recalculate: calculateETA
  };
};
