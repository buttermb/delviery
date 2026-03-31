import type { SupabaseClient } from '../../_shared/deps.ts';
import { jsonResponse, type CourierRecord } from '../utils.ts';

export async function handleToggleOnline(
  supabase: SupabaseClient,
  courier: CourierRecord,
  body: Record<string, unknown>,
): Promise<Response> {
  const isOnline = body.is_online as boolean;

  let shiftId: string | null = null;

  if (isOnline) {
    const { data: shift } = await supabase
      .from("courier_shifts")
      .insert({
        courier_id: courier.id,
        started_at: new Date().toISOString(),
        status: 'active',
      })
      .select()
      .single();
    shiftId = shift?.id ?? null;
  } else {
    const { data: activeShift } = await supabase
      .from("courier_shifts")
      .select("*")
      .eq("courier_id", courier.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeShift) {
      const endTime = new Date();
      const startTime = new Date(activeShift.started_at);
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      await supabase
        .from("courier_shifts")
        .update({
          ended_at: endTime.toISOString(),
          total_hours: hours,
          status: 'completed',
        })
        .eq("id", activeShift.id);
    }
  }

  const { data: updatedCourier } = await supabase
    .from("couriers")
    .update({
      is_online: isOnline,
      available_for_orders: isOnline,
    })
    .eq("id", courier.id)
    .select()
    .single();

  return jsonResponse({
    success: true,
    is_online: isOnline,
    shift_id: shiftId,
    courier: updatedCourier,
  });
}
