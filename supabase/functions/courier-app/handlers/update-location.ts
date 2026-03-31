import type { SupabaseClient } from '../../_shared/deps.ts';
import { jsonResponse, type CourierRecord } from '../utils.ts';

export async function handleUpdateLocation(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const { lat, lng, accuracy, speed, heading, order_id } = body;

  await supabase
    .from("couriers")
    .update({
      current_lat: lat,
      current_lng: lng,
      last_location_update: new Date().toISOString(),
    })
    .eq("id", courier.id);

  await supabase
    .from("courier_location_history")
    .insert({
      courier_id: courier.id,
      lat,
      lng,
      accuracy,
      speed,
      heading,
      order_id,
    });

  return jsonResponse({ success: true });
}
