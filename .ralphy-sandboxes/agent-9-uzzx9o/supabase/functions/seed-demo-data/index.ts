import { serve, createClient, corsHeaders, z } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('seed-demo-data');

// Zod validation schema
const seedDemoDataSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID'),
  scale: z.enum(['small', 'large']).default('small'),
});

// Product name templates for generating varied products
const PRODUCT_PREFIXES = ['Premium', 'Organic', 'Classic', 'Artisan', 'Select', 'Reserve', 'Gold', 'Silver', 'Platinum', 'Diamond'];
const PRODUCT_TYPES = ['Flower', 'Edibles', 'Vapes', 'Pre-Rolls', 'Concentrates', 'Tinctures', 'Topicals', 'Capsules', 'Drinks', 'Accessories'];
const STRAIN_NAMES = ['OG Kush', 'Blue Dream', 'Sour Diesel', 'Girl Scout Cookies', 'Gorilla Glue', 'Wedding Cake', 'Gelato', 'Zkittlez', 'Purple Haze', 'Jack Herer'];

function generateProducts(tenantId: string, count: number) {
  return Array.from({ length: count }).map((_, i) => {
    const prefix = PRODUCT_PREFIXES[i % PRODUCT_PREFIXES.length];
    const type = PRODUCT_TYPES[i % PRODUCT_TYPES.length];
    const strain = STRAIN_NAMES[i % STRAIN_NAMES.length];
    const variant = Math.floor(i / PRODUCT_TYPES.length) + 1;
    const price = 10 + Math.floor(Math.random() * 90);
    const qty = Math.floor(Math.random() * 200);

    return {
      tenant_id: tenantId,
      name: `${prefix} ${strain} ${type} #${variant}`,
      description: `${prefix} quality ${type.toLowerCase()} featuring ${strain} genetics`,
      price,
      wholesale_price: price,
      category: type,
      stock_quantity: qty,
      available_quantity: qty,
      is_active: true,
      menu_visibility: Math.random() > 0.2,
      sku: `SKU-${type.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
    };
  });
}

function generateOrders(tenantId: string, customerIds: string[], count: number) {
  const statuses = ['pending', 'processing', 'completed', 'cancelled'];
  const paymentStatuses = ['paid', 'unpaid', 'partial'];

  return Array.from({ length: count }).map((_, i) => ({
    tenant_id: tenantId,
    customer_id: customerIds[i % customerIds.length],
    status: statuses[i % statuses.length],
    total_amount: Math.floor(Math.random() * 500) + 25,
    payment_status: paymentStatuses[i % paymentStatuses.length],
    created_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = seedDemoDataSchema.safeParse(rawBody);

    if (!validationResult.success) {
      logger.warn('Validation failed', { errors: validationResult.error.flatten() });
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id, scale } = validationResult.data;
    const isLarge = scale === 'large';

    const customerCount = isLarge ? 15 : 5;
    const productCount = isLarge ? 100 : 5;
    const orderCount = isLarge ? 50 : 10;

    logger.info('Starting demo data seed', { tenantId: tenant_id, scale, productCount, orderCount });

    // 1. Create dummy customers
    const customers = Array.from({ length: customerCount }).map((_, i) => ({
      tenant_id,
      full_name: `Customer ${i + 1}`,
      email: `customer${i + 1}@example.com`,
      phone: `555-${String(i + 100).padStart(4, '0')}`,
      status: 'active',
      total_orders: Math.floor(Math.random() * 10),
      total_spent: Math.floor(Math.random() * 1000),
    }));

    const { data: createdCustomers, error: customerError } = await supabaseClient
      .from('customers')
      .insert(customers)
      .select();

    if (customerError) {
      logger.error('Failed to create customers', { error: customerError.message });
      throw customerError;
    }

    // 2. Create products
    const products = isLarge
      ? generateProducts(tenant_id, productCount)
      : [
          { name: 'Premium Flower', price: 45, category: 'Flower' },
          { name: 'Edible Gummies', price: 25, category: 'Edibles' },
          { name: 'Vape Cartridge', price: 35, category: 'Vapes' },
          { name: 'Pre-Roll Pack', price: 15, category: 'Pre-Rolls' },
          { name: 'Concentrate Wax', price: 55, category: 'Concentrates' },
        ].map((p) => ({
          tenant_id,
          name: p.name,
          description: `Sample ${p.name}`,
          price: p.price,
          category: p.category,
          stock_quantity: 100,
          is_active: true,
        }));

    // Insert products in batches of 50 to avoid payload limits
    const productBatchSize = 50;
    const createdProducts: Array<{ id: string }> = [];
    for (let i = 0; i < products.length; i += productBatchSize) {
      const batch = products.slice(i, i + productBatchSize);
      const { data, error } = await supabaseClient.from('products').insert(batch).select('id');
      if (error) {
        logger.error('Failed to create products batch', { error: error.message, batchIndex: i });
        throw error;
      }
      if (data) createdProducts.push(...data);
    }

    // 3. Create orders
    const customerIds = createdCustomers!.map((c) => c.id);
    const orders = isLarge
      ? generateOrders(tenant_id, customerIds, orderCount)
      : createdCustomers!.flatMap((customer, idx) => {
          return Array.from({ length: 2 }).map((_, orderIdx) => ({
            tenant_id,
            customer_id: customer.id,
            status: ['pending', 'processing', 'completed'][((idx * 2) + orderIdx) % 3],
            total_amount: Math.floor(Math.random() * 200) + 50,
            payment_status: 'paid',
            created_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
          }));
        });

    const { error: orderError } = await supabaseClient.from('orders').insert(orders);

    if (orderError) {
      logger.error('Failed to create orders', { error: orderError.message });
      throw orderError;
    }

    // Update tenant flag
    await supabaseClient.from('tenants').update({ demo_data_generated: true }).eq('id', tenant_id);

    logger.info('Demo data seeded successfully', {
      tenantId: tenant_id,
      scale,
      customers: createdCustomers?.length,
      products: createdProducts.length,
      orders: orders.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Demo data generated successfully (${scale} scale)`,
        counts: { customers: createdCustomers?.length, products: createdProducts.length, orders: orders.length },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    logger.error('Seed demo data error', { error: error instanceof Error ? error.message : 'Unknown' });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to seed demo data' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
