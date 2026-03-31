import type { SupabaseClient } from '../../_shared/deps.ts';
import { jsonResponse, type CourierRecord } from '../utils.ts';

export async function handleLogin(
  supabase: SupabaseClient,
  courier: CourierRecord,
): Promise<Response> {
  await supabase
    .from("couriers")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", courier.id);

  return jsonResponse({
    courier: {
      id: courier.id,
      email: courier.email,
      full_name: courier.full_name,
      phone: courier.phone,
      vehicle_type: courier.vehicle_type,
      is_online: courier.is_online,
      commission_rate: courier.commission_rate,
    },
  });
}
