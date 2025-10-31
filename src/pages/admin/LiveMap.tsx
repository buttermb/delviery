import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MapPin, Truck } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

interface CourierLocation {
  id: string;
  full_name: string;
  is_online: boolean;
  current_lat: number;
  current_lng: number;
}

export default function LiveMap() {
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourierLocations();
    
    // Refresh every 10 seconds
    const interval = setInterval(loadCourierLocations, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadCourierLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, full_name, is_online, current_lat, current_lng')
        .eq('is_online', true)
        .not('current_lat', 'is', null)
        .not('current_lng', 'is', null);
      
      if (error) throw error;
      setCouriers(data || []);
    } catch (error: any) {
      console.error('Error loading courier locations:', error);
      toast.error('Failed to load courier locations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead 
        title="Live Map | Admin"
        description="Real-time courier tracking"
      />
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Live Courier Map</h1>
          <Badge variant="default" className="animate-pulse">Live</Badge>
        </div>

        <Card className="p-4">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
            <div className="text-center space-y-2">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Map integration placeholder</p>
              <p className="text-xs text-muted-foreground">Install Mapbox GL JS for full map functionality</p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Online Couriers ({couriers.length})
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : couriers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No couriers online</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {couriers.map((courier) => (
                  <Card key={courier.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{courier.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {courier.current_lat?.toFixed(4)}, {courier.current_lng?.toFixed(4)}
                        </p>
                      </div>
                      <Badge variant="default" className="text-xs">Online</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
