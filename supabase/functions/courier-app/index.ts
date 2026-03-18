import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { withZenProtection } from '../_shared/zen-firewall.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('courier-app');

// --- Zod schemas per endpoint ---

const EndpointSchema = z.object({
  endpoint: z.enum([
    'login',
    'toggle-online',
    'update-location',
    'my-orders',
    'available-orders',
    'accept-order',
    'update-order-status',
    'mark-picked-up',
    'mark-delivered',
    'earnings',
    'today-stats',
  ]),
});

const ToggleOnlineSchema = z.object({
  endpoint: z.literal('toggle-online'),
  is_online: z.boolean(),
});

const UpdateLocationSchema = z.object({
  endpoint: z.literal('update-location'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  order_id: z.string().uuid().optional(),
});

const MyOrdersSchema = z.object({
  endpoint: z.literal('my-orders'),
  status: z.enum(['all', 'active', 'pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']).default('all'),
});

const AcceptOrderSchema = z.object({
  endpoint: z.literal('accept-order'),
  order_id: z.string().uuid(),
});

const UpdateOrderStatusSchema = z.object({
  endpoint: z.literal('update-order-status'),
  order_id: z.string().uuid(),
  status: z.string().min(1),
  notes: z.string().optional(),
});

const MarkPickedUpSchema = z.object({
  endpoint: z.literal('mark-picked-up'),
  order_id: z.string().uuid(),
  pickup_photo_url: z.string().url().optional(),
});

const MarkDeliveredSchema = z.object({
  endpoint: z.literal('mark-delivered'),
  order_id: z.string().uuid(),
  delivery_photo_url: z.string().url().optional(),
  signature_url: z.string().url().optional(),
  id_verification_photo_url: z.string().url().optional(),
  customer_present: z.boolean().optional(),
});

const EarningsSchema = z.object({
  endpoint: z.literal('earnings'),
  period: z.enum(['week', 'month', 'all']).default('week'),
});

// --- Helpers ---

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface CourierRecord {
  id: string;
  user_id: string;
  tenant_id: string | null;
  email: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  commission_rate: number;
  current_lat: number | null;
  current_lng: number | null;
  [key: string]: unknown;
}

/** Enrich orders with customer info from profiles when missing */
async function enrichOrdersWithCustomerInfo(
  supabase: ReturnType<typeof createClient>,
  orders: Record<string, unknown>[],
) {
  return Promise.all(
    orders.map(async (order) => {
      let customerName = order.customer_name as string | null;
      let customerPhone = order.customer_phone as string | null;

      if (!customerName || !customerPhone) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', order.user_id as string)
          .maybeSingle();

        if (profile) {
          customerName = (profile.full_name as string) || customerName;
          customerPhone = (profile.phone as string) || customerPhone;
        }
      }

      return { ...order, customer_name: customerName, customer_phone: customerPhone };
    }),
  );
}

// --- Handler ---

serve(
  withZenProtection(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseKey) {
        logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        return errorResponse('Server configuration error', 500);
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // --- Auth ---
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        logger.warn('Missing authorization header');
        return errorResponse('Missing authorization', 401);
      }

      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError || !user) {
        logger.warn('Unauthorized access attempt', { error: authError?.message });
        return errorResponse('Unauthorized', 401);
      }

      // --- Lookup courier ---
      const { data: courier } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle() as { data: CourierRecord | null };

      if (!courier || !courier.is_active) {
        logger.warn('Courier not found or inactive', { userId: user.id });
        return errorResponse('Courier account not found or inactive', 403);
      }

      // --- Parse & validate endpoint ---
      const rawBody = await req.json();
      const endpointResult = EndpointSchema.safeParse(rawBody);

      if (!endpointResult.success) {
        logger.warn('Invalid endpoint', { errors: endpointResult.error.flatten() });
        return errorResponse('Invalid endpoint', 400);
      }

      const { endpoint } = endpointResult.data;
      logger.info('Request', { endpoint, courierId: courier.id, tenantId: courier.tenant_id ?? undefined });

      // ============================================================
      // LOGIN
      // ============================================================
      if (endpoint === 'login') {
        await supabase
          .from('couriers')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', courier.id);

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

      // ============================================================
      // TOGGLE ONLINE
      // ============================================================
      if (endpoint === 'toggle-online') {
        const parsed = ToggleOnlineSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid request body', 400);
        const { is_online: isOnline } = parsed.data;

        let shiftId: string | null = null;

        if (isOnline) {
          const { data: shift } = await supabase
            .from('courier_shifts')
            .insert({
              courier_id: courier.id,
              started_at: new Date().toISOString(),
              status: 'active',
            })
            .select('id')
            .maybeSingle();
          shiftId = shift?.id ?? null;
        } else {
          const { data: activeShift } = await supabase
            .from('courier_shifts')
            .select('id, started_at')
            .eq('courier_id', courier.id)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (activeShift) {
            const endTime = new Date();
            const startTime = new Date(activeShift.started_at);
            const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

            await supabase
              .from('courier_shifts')
              .update({ ended_at: endTime.toISOString(), total_hours: hours, status: 'completed' })
              .eq('id', activeShift.id);
          }
        }

        const { data: updatedCourier } = await supabase
          .from('couriers')
          .update({ is_online: isOnline, available_for_orders: isOnline })
          .eq('id', courier.id)
          .select()
          .maybeSingle();

        return jsonResponse({ success: true, is_online: isOnline, shift_id: shiftId, courier: updatedCourier });
      }

      // ============================================================
      // UPDATE LOCATION
      // ============================================================
      if (endpoint === 'update-location') {
        const parsed = UpdateLocationSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid location data', 400);
        const { lat, lng, accuracy, speed, heading, order_id } = parsed.data;

        await supabase
          .from('couriers')
          .update({ current_lat: lat, current_lng: lng, last_location_update: new Date().toISOString() })
          .eq('id', courier.id);

        await supabase.from('courier_location_history').insert({
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

      // ============================================================
      // MY ORDERS
      // ============================================================
      if (endpoint === 'my-orders') {
        const parsed = MyOrdersSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid request body', 400);
        const { status } = parsed.data;

        let query = supabase
          .from('orders')
          .select('*, merchants (*), addresses (*), order_items (*, products (*))')
          .eq('courier_id', courier.id)
          .order('created_at', { ascending: false });

        if (courier.tenant_id) {
          query = query.eq('tenant_id', courier.tenant_id);
        }

        if (status === 'active') {
          query = query.in('status', ['preparing', 'out_for_delivery']);
        } else if (status !== 'all') {
          query = query.eq('status', status);
        }

        const { data: orders, error } = await query;

        if (error) {
          logger.error('Orders query error', { error: error.message });
          return jsonResponse({ error: error.message, orders: [] });
        }

        const enriched = await enrichOrdersWithCustomerInfo(supabase, orders || []);
        const withCommission = enriched.map((order) => {
          const commission =
            (parseFloat(String(order.subtotal || order.total_amount)) * courier.commission_rate) / 100;
          return { ...order, courier_commission: commission.toFixed(2) };
        });

        return jsonResponse({ orders: withCommission, count: withCommission.length });
      }

      // ============================================================
      // AVAILABLE ORDERS
      // ============================================================
      if (endpoint === 'available-orders') {
        let query = supabase
          .from('orders')
          .select('*, merchants (*), addresses (*)')
          .eq('status', 'pending')
          .is('courier_id', null)
          .order('created_at', { ascending: true })
          .limit(20);

        if (courier.tenant_id) {
          query = query.eq('tenant_id', courier.tenant_id);
        }

        const { data: orders } = await query;
        const enriched = await enrichOrdersWithCustomerInfo(supabase, orders || []);

        return jsonResponse({ orders: enriched });
      }

      // ============================================================
      // ACCEPT ORDER
      // ============================================================
      if (endpoint === 'accept-order') {
        const parsed = AcceptOrderSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid request body', 400);
        const { order_id: orderId } = parsed.data;

        logger.info('Accept order', { orderId, courierId: courier.id });

        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .is('courier_id', null)
          .maybeSingle();

        if (!order) {
          logger.warn('Order not available or already assigned', { orderId });
          return errorResponse('Order no longer available', 400);
        }

        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({
            courier_id: courier.id,
            courier_assigned_at: new Date().toISOString(),
            courier_accepted_at: new Date().toISOString(),
            status: 'preparing',
          })
          .eq('id', orderId)
          .select(
            '*, merchants (id, business_name, address, phone, latitude, longitude), addresses (street, apartment, city, state, zip_code, borough, latitude, longitude), order_items (id, quantity, price, product_name, products (id, name, image_url, description))',
          )
          .maybeSingle();

        if (updateError) {
          logger.error('Error updating order', { error: updateError.message });
          return errorResponse(updateError.message, 500);
        }

        if (!updatedOrder) {
          return errorResponse('Failed to update order', 500);
        }

        // Enrich with customer info
        let customerName = updatedOrder.customer_name as string | null;
        let customerPhone = updatedOrder.customer_phone as string | null;

        if (!customerName || !customerPhone) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('user_id', updatedOrder.user_id)
            .maybeSingle();

          if (profile) {
            customerName = (profile.full_name as string) || customerName;
            customerPhone = (profile.phone as string) || customerPhone;
          }
        }

        // Customer order count
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', updatedOrder.user_id)
          .eq('status', 'delivered');

        await supabase.from('order_tracking').insert({
          order_id: orderId,
          status: 'preparing',
          message: `Courier ${courier.full_name} accepted the order`,
        });

        logger.info('Order accepted', { orderId, courierId: courier.id });

        return jsonResponse({
          success: true,
          order: {
            ...updatedOrder,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_order_count: count || 0,
          },
        });
      }

      // ============================================================
      // UPDATE ORDER STATUS
      // ============================================================
      if (endpoint === 'update-order-status') {
        const parsed = UpdateOrderStatusSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid request body', 400);
        const { order_id, status: newStatus, notes } = parsed.data;

        const { data: updatedOrder } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', order_id)
          .eq('courier_id', courier.id)
          .select()
          .maybeSingle();

        await supabase.from('order_tracking').insert({
          order_id,
          status: newStatus,
          message: notes || `Status updated to ${newStatus}`,
        });

        return jsonResponse({ success: true, order: updatedOrder });
      }

      // ============================================================
      // MARK PICKED UP
      // ============================================================
      if (endpoint === 'mark-picked-up') {
        const parsed = MarkPickedUpSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid request body', 400);
        const { order_id, pickup_photo_url } = parsed.data;

        await supabase
          .from('orders')
          .update({ status: 'out_for_delivery' })
          .eq('id', order_id)
          .eq('courier_id', courier.id);

        await supabase
          .from('deliveries')
          .update({ actual_pickup_time: new Date().toISOString(), pickup_photo_url })
          .eq('order_id', order_id);

        await supabase.from('order_tracking').insert({
          order_id,
          status: 'out_for_delivery',
          message: 'Order picked up and out for delivery',
        });

        return jsonResponse({ success: true });
      }

      // ============================================================
      // MARK DELIVERED
      // ============================================================
      if (endpoint === 'mark-delivered') {
        const parsed = MarkDeliveredSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid request body', 400);
        const { order_id, delivery_photo_url, signature_url, id_verification_photo_url, customer_present } =
          parsed.data;

        const now = new Date().toISOString();

        const { data: deliveredOrder } = await supabase
          .from('orders')
          .update({ status: 'delivered', delivered_at: now })
          .eq('id', order_id)
          .eq('courier_id', courier.id)
          .select('id, order_number, subtotal, total_amount, delivery_fee, tip_amount, tenant_id, customer_name, user_id')
          .maybeSingle();

        await supabase
          .from('deliveries')
          .update({
            actual_dropoff_time: now,
            delivery_photo_url,
            signature_url,
            id_verification_url: id_verification_photo_url,
            delivery_notes: customer_present ? 'Delivered to customer' : 'Left at door',
          })
          .eq('order_id', order_id);

        await supabase.from('order_tracking').insert({
          order_id,
          status: 'delivered',
          message: 'Order delivered successfully',
        });

        // Create earnings record
        if (deliveredOrder) {
          const orderTotal = parseFloat(String(deliveredOrder.subtotal || deliveredOrder.total_amount)) || 0;
          const commissionRate = courier.commission_rate || 30;
          const commissionAmount = (orderTotal * commissionRate) / 100;
          const tipAmount = parseFloat(String(deliveredOrder.tip_amount)) || 0;
          const totalEarned = commissionAmount + tipAmount;

          // Compute week_start_date (Monday of current week)
          const today = new Date();
          const dayOfWeek = today.getDay();
          const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const monday = new Date(today);
          monday.setDate(today.getDate() + mondayOffset);
          const weekStartDate = monday.toISOString().split('T')[0];

          await supabase.from('courier_earnings').insert({
            courier_id: courier.id,
            order_id: deliveredOrder.id,
            order_total: orderTotal,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            tip_amount: tipAmount,
            total_earned: totalEarned,
            week_start_date: weekStartDate,
            status: 'pending',
          });

          // Log delivery_completed to driver_activity_log
          if (courier.tenant_id) {
            const { data: orderAddresses } = await supabase
              .from('orders')
              .select('delivery_address, pickup_lat, pickup_lng, merchants(business_name, address)')
              .eq('id', deliveredOrder.id)
              .maybeSingle();

            const pickupAddress =
              (orderAddresses?.merchants as Record<string, unknown>)?.address ||
              (orderAddresses?.merchants as Record<string, unknown>)?.business_name ||
              null;

            await supabase.from('driver_activity_log').insert({
              tenant_id: courier.tenant_id,
              driver_id: courier.id,
              event_type: 'delivery_completed',
              event_data: {
                order_id: deliveredOrder.id,
                order_number: deliveredOrder.order_number,
                total_earned: totalEarned,
                customer_name: deliveredOrder.customer_name,
                tip: tipAmount > 0 ? tipAmount.toFixed(2) : null,
                pickup: pickupAddress,
                dropoff: orderAddresses?.delivery_address || null,
              },
            });
          }

          logger.info('Delivery completed', { orderId: order_id, courierId: courier.id, totalEarned });
        }

        return jsonResponse({ success: true });
      }

      // ============================================================
      // EARNINGS
      // ============================================================
      if (endpoint === 'earnings') {
        const parsed = EarningsSchema.safeParse(rawBody);
        if (!parsed.success) return errorResponse('Invalid request body', 400);
        const { period } = parsed.data;

        let query = supabase
          .from('courier_earnings')
          .select('*')
          .eq('courier_id', courier.id)
          .order('created_at', { ascending: false });

        if (period === 'week') {
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          weekStart.setHours(0, 0, 0, 0);
          query = query.gte('created_at', weekStart.toISOString());
        } else if (period === 'month') {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          query = query.gte('created_at', monthStart.toISOString());
        }

        const { data: earnings } = await query;
        const totalEarned = earnings?.reduce((sum: number, e: Record<string, unknown>) => sum + parseFloat(String(e.total_earned)), 0) || 0;
        const totalDeliveries = earnings?.length || 0;
        const avgPerDelivery = totalDeliveries > 0 ? totalEarned / totalDeliveries : 0;

        return jsonResponse({
          earnings: earnings || [],
          summary: {
            total_earned: totalEarned.toFixed(2),
            total_deliveries: totalDeliveries,
            avg_per_delivery: avgPerDelivery.toFixed(2),
          },
        });
      }

      // ============================================================
      // TODAY STATS
      // ============================================================
      if (endpoint === 'today-stats') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [{ data: todayOrders }, { data: todayEarnings }, { data: activeShift }] = await Promise.all([
          supabase.from('orders').select('status').eq('courier_id', courier.id).gte('created_at', today.toISOString()),
          supabase
            .from('courier_earnings')
            .select('total_earned')
            .eq('courier_id', courier.id)
            .gte('created_at', today.toISOString()),
          supabase
            .from('courier_shifts')
            .select('started_at')
            .eq('courier_id', courier.id)
            .eq('status', 'active')
            .maybeSingle(),
        ]);

        const deliveries = todayOrders?.filter((o: Record<string, unknown>) => o.status === 'delivered').length || 0;
        const totalEarnings =
          todayEarnings?.reduce((sum: number, e: Record<string, unknown>) => sum + parseFloat(String(e.total_earned)), 0) || 0;

        let hoursOnline = 0;
        if (activeShift) {
          hoursOnline = (Date.now() - new Date(activeShift.started_at).getTime()) / (1000 * 60 * 60);
        }

        return jsonResponse({
          deliveries_completed: deliveries,
          total_earned: totalEarnings.toFixed(2),
          hours_online: hoursOnline.toFixed(1),
          active_orders:
            todayOrders?.filter((o: Record<string, unknown>) =>
              ['preparing', 'out_for_delivery'].includes(o.status as string),
            ).length || 0,
        });
      }

      return errorResponse('Invalid endpoint', 400);
    } catch (error) {
      logger.error('Unexpected error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return errorResponse('Internal server error', 500);
    }
  }),
);
