import { createClient, corsHeaders } from '../_shared/deps.ts';
import { validateCreateOrder, type CreateOrderInput } from './validation.ts';
import { withCreditGate, CREDIT_ACTIONS } from '../_shared/creditGate.ts';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Wrap the handler with credit gating for free tier users
  return withCreditGate(req, CREDIT_ACTIONS.CREATE_ORDER, async (tenantId, serviceClient) => {
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      )

      const rawBody = await req.json();
      const orderData: CreateOrderInput = validateCreateOrder(rawBody);

      // Validate required fields
      if (!orderData.deliveryAddress || !orderData.deliveryBorough) {
        throw new Error('Delivery address and borough are required')
      }

      if (orderData.cartItems.length === 0) {
        throw new Error('Cart is empty')
      }

      // Get merchant location data if not provided
      if (!orderData.pickupLat || !orderData.pickupLng) {
        const { data: product, error: productError } = await supabaseClient
          .from('products')
          .select('merchant_id, merchants(id, latitude, longitude)')
          .eq('id', orderData.cartItems[0].productId)
          .maybeSingle()

        if (productError) {
          console.error('Error fetching merchant:', productError)
        } else if (product?.merchants) {
          const merchant = Array.isArray(product.merchants) ? product.merchants[0] : product.merchants
          orderData.pickupLat = merchant?.latitude
          orderData.pickupLng = merchant?.longitude
          orderData.merchantId = merchant?.id
        }
      }

      // SECURITY: Get user ID from auth token, not from client request
      const { data: { user } } = await supabaseClient.auth.getUser();
      const authenticatedUserId = user?.id || null;

      // SECURITY: Fetch product prices from database - NEVER trust client prices
      const productIds = orderData.cartItems.map(item => item.productId);
      const { data: products, error: productsError } = await supabaseClient
        .from('products')
        .select('id, price, name')
        .in('id', productIds);

      if (productsError) {
        console.error('Error fetching product prices:', productsError);
        throw new Error('Failed to validate product prices');
      }

      // Create price lookup map
      const productPriceMap = new Map(products?.map(p => [p.id, { price: Number(p.price), name: p.name }]) || []);

      // Recalculate subtotal and total from SERVER prices
      let calculatedSubtotal = 0;
      const validatedCartItems = orderData.cartItems.map(item => {
        const product = productPriceMap.get(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        // Use DATABASE price, not client price
        const serverPrice = product.price;
        calculatedSubtotal += serverPrice * item.quantity;
        return {
          ...item,
          price: serverPrice, // Override with server price
          productName: product.name, // Also use server product name
        };
      });

      // Use configured delivery fee or a fixed fee (don't trust client)
      const DELIVERY_FEE = 5.00; // Could fetch from config table
      const calculatedTotal = calculatedSubtotal + DELIVERY_FEE;

      console.log(`[CREATE_ORDER] Server-calculated: subtotal=${calculatedSubtotal}, total=${calculatedTotal}`);

      // Create order with SERVER-calculated values
      const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .insert({
          user_id: authenticatedUserId, // From auth token, not client
          merchant_id: orderData.merchantId,
          delivery_address: orderData.deliveryAddress,
          delivery_borough: orderData.deliveryBorough,
          payment_method: orderData.paymentMethod,
          delivery_fee: DELIVERY_FEE, // Server-side fee
          subtotal: calculatedSubtotal, // Server-calculated
          total_amount: calculatedTotal, // Server-calculated
          scheduled_delivery_time: orderData.scheduledDeliveryTime || null,
          delivery_notes: orderData.deliveryNotes || null,
          status: 'pending',
          pickup_lat: orderData.pickupLat,
          pickup_lng: orderData.pickupLng,
          dropoff_lat: orderData.dropoffLat,
          dropoff_lng: orderData.dropoffLng,
          customer_name: orderData.customerName || null,
          customer_phone: orderData.customerPhone || null,
        })
        .select()
        .single()

      if (orderError) {
        console.error('Order creation error:', orderError)
        throw new Error(`Failed to create order: ${orderError.message}`)
      }

      // Insert order items in bulk with SERVER-validated prices
      const orderItems = validatedCartItems.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        price: item.price, // Server-validated price
        product_name: item.productName, // Server-validated name
      }))

      const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        // Order was created, so log error but don't fail completely
        console.error('Order items insertion failed')
      }

      // Clear cart in background (non-blocking)
      if (authenticatedUserId) {
        supabaseClient
          .from('cart_items')
          .delete()
          .eq('user_id', authenticatedUserId)
          .then(({ error }) => {
            if (error) console.error('Failed to clear cart')
          })
      }

      return new Response(
        JSON.stringify({
          success: true,
          orderId: order.id,
          trackingCode: order.tracking_code
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )

    } catch (error) {
      console.error('Order creation failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order'
      return new Response(
        JSON.stringify({
          error: errorMessage
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }
  }); // End of withCreditGate
})
