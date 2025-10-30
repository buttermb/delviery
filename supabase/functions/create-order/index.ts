import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderRequest {
  userId?: string
  merchantId?: string
  deliveryAddress: string
  deliveryBorough: string
  paymentMethod: string
  deliveryFee: number
  subtotal: number
  totalAmount: number
  scheduledDeliveryTime?: string
  deliveryNotes?: string
  pickupLat?: number
  pickupLng?: number
  dropoffLat?: number
  dropoffLng?: number
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  cartItems: Array<{
    productId: string
    quantity: number
    price: number
    productName: string
    selectedWeight: string
  }>
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

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

    const orderData: OrderRequest = await req.json()
    console.log('Creating order:', { 
      userId: orderData.userId, 
      itemCount: orderData.cartItems.length,
      total: orderData.totalAmount 
    })

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

    // Create order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        user_id: orderData.userId || null,
        merchant_id: orderData.merchantId,
        delivery_address: orderData.deliveryAddress,
        delivery_borough: orderData.deliveryBorough,
        payment_method: orderData.paymentMethod,
        delivery_fee: orderData.deliveryFee,
        subtotal: orderData.subtotal,
        total_amount: orderData.totalAmount,
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

    console.log('Order created:', order.id)

    // Insert order items in bulk
    const orderItems = orderData.cartItems.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
      product_name: item.productName,
    }))

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Order items error:', itemsError)
      // Order was created, so log error but don't fail completely
      console.error('Order items insertion failed, but order exists:', order.id)
    }

    // Clear cart in background (non-blocking)
    if (orderData.userId) {
      supabaseClient
        .from('cart_items')
        .delete()
        .eq('user_id', orderData.userId)
        .then(({ error }) => {
          if (error) console.error('Failed to clear cart:', error)
        })
    }

    console.log('Order completed successfully:', order.id)

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
})
