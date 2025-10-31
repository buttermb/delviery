import { supabase } from "@/integrations/supabase/client";

export interface RunnerLocation {
  lat: number;
  lng: number;
  timestamp: string;
  speed?: number;
  heading?: number;
}

export async function assignRunnerToDelivery(runnerId: string, deliveryId: string) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      runner_id: runnerId,
      status: 'assigned',
      assigned_at: new Date().toISOString()
    })
    .eq('id', deliveryId)
    .select()
    .single();

  if (error) throw error;

  // Update runner status
  await supabase
    .from('runners')
    .update({ status: 'active' })
    .eq('id', runnerId);

  return data;
}

export async function updateRunnerLocation(
  runnerId: string,
  lat: number,
  lng: number,
  speed?: number,
  heading?: number
) {
  // Insert location history
  await supabase
    .from('runner_locations')
    .insert({
      runner_id: runnerId,
      lat,
      lng,
      speed,
      heading,
      timestamp: new Date().toISOString()
    });

  // Update runner current position
  await supabase
    .from('runners')
    .update({
      current_lat: lat,
      current_lng: lng,
      last_location_update: new Date().toISOString()
    })
    .eq('id', runnerId);
}

export async function calculateETA(
  runnerId: string,
  destinationLat: number,
  destinationLng: number
): Promise<number> {
  const { data: runner } = await supabase
    .from('runners')
    .select('current_lat, current_lng')
    .eq('id', runnerId)
    .single();

  if (!runner || !runner.current_lat || !runner.current_lng) {
    return 30; // Default 30 minutes if no location
  }

  // Simple distance calculation (Haversine formula)
  const R = 6371; // Earth's radius in km
  const dLat = (destinationLat - runner.current_lat) * Math.PI / 180;
  const dLon = (destinationLng - runner.current_lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(runner.current_lat * Math.PI / 180) * 
    Math.cos(destinationLat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  // Estimate time (assuming 30 km/h average speed in city)
  const avgSpeed = 30;
  const minutes = Math.round((distance / avgSpeed) * 60);

  return minutes;
}

export async function getActiveDeliveries() {
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      runners (
        id,
        full_name,
        phone,
        vehicle_type,
        current_lat,
        current_lng,
        rating
      ),
      orders (
        order_number,
        total_amount
      )
    `)
    .in('status', ['assigned', 'picked_up', 'in_transit'])
    .order('scheduled_time', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAvailableRunners() {
  const { data, error } = await supabase
    .from('runners')
    .select('*')
    .eq('status', 'available')
    .eq('is_active', true)
    .order('rating', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function recordDeliveryCompletion(
  deliveryId: string,
  notes?: string,
  photoProofUrl?: string
) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status: 'delivered',
      actual_delivery_time: new Date().toISOString(),
      completion_notes: notes,
      photo_proof_url: photoProofUrl
    })
    .eq('id', deliveryId)
    .select()
    .single();

  if (error) throw error;

  // Update runner status to available
  if (data.runner_id) {
    await supabase
      .from('runners')
      .update({ status: 'available' })
      .eq('id', data.runner_id);

    // Update runner stats
    await supabase.rpc('increment', {
      table_name: 'runners',
      id: data.runner_id,
      column_name: 'total_deliveries',
      value: 1
    });
  }

  return data;
}

export async function recordPaymentCollection(
  deliveryId: string,
  amount: number,
  paymentMethod: 'cash' | 'transfer' | 'check'
) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      collection_amount: amount,
      collection_method: paymentMethod,
      collected_at: new Date().toISOString()
    })
    .eq('id', deliveryId)
    .select()
    .single();

  if (error) throw error;

  // Record payment in credit transactions
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('order_id, orders(wholesale_clients(id))')
    .eq('id', deliveryId)
    .single();

  if (delivery?.orders?.wholesale_clients?.id) {
    await supabase.from('credit_transactions').insert({
      client_id: delivery.orders.wholesale_clients.id,
      amount,
      transaction_type: 'payment_received',
      order_id: delivery.order_id,
      notes: `Payment collected by runner via ${paymentMethod}`
    });
  }

  return data;
}

export async function getRunnerPerformance(runnerId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('runner_id', runnerId)
    .eq('status', 'delivered')
    .gte('actual_delivery_time', startDate.toISOString());

  if (error) throw error;

  const deliveries = data || [];
  const totalDeliveries = deliveries.length;
  const totalCollected = deliveries.reduce((sum, d) => sum + (d.collection_amount || 0), 0);
  
  // Calculate average delivery time
  const deliveryTimes = deliveries
    .filter(d => d.scheduled_time && d.actual_delivery_time)
    .map(d => {
      const scheduled = new Date(d.scheduled_time!).getTime();
      const actual = new Date(d.actual_delivery_time!).getTime();
      return (actual - scheduled) / 60000; // minutes
    });

  const avgDeliveryTime = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : 0;

  return {
    totalDeliveries,
    totalCollected,
    avgDeliveryTime,
    successRate: 100 // Can be calculated based on failed/cancelled deliveries
  };
}
