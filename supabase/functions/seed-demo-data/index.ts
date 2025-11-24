import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { tenant_id } = await req.json();

        if (!tenant_id) {
            throw new Error('Missing tenant_id');
        }

        // 1. Create dummy customers
        const customers = Array.from({ length: 5 }).map((_, i) => ({
            tenant_id,
            full_name: `Customer ${i + 1}`,
            email: `customer${i + 1}@example.com`,
            phone: `555-010${i}`,
            status: 'active',
            total_orders: Math.floor(Math.random() * 10),
            total_spent: Math.floor(Math.random() * 1000),
        }));

        const { data: createdCustomers, error: customerError } = await supabaseClient
            .from('customers')
            .insert(customers)
            .select();

        if (customerError) throw customerError;

        // 2. Create dummy products
        const products = [
            { name: 'Premium Flower', price: 45, category: 'Flower' },
            { name: 'Edible Gummies', price: 25, category: 'Edibles' },
            { name: 'Vape Cartridge', price: 35, category: 'Vapes' },
        ].map(p => ({
            tenant_id,
            name: p.name,
            description: `Sample ${p.name}`,
            price: p.price,
            category: p.category,
            stock_quantity: 100,
            is_active: true,
        }));

        const { data: createdProducts, error: productError } = await supabaseClient
            .from('products')
            .insert(products)
            .select();

        if (productError) throw productError;

        // 3. Create dummy orders
        const orders = createdCustomers!.flatMap(customer => {
            return Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map(() => ({
                tenant_id,
                customer_id: customer.id,
                status: ['pending', 'processing', 'completed'][Math.floor(Math.random() * 3)],
                total_amount: Math.floor(Math.random() * 200) + 50,
                payment_status: 'paid',
                created_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(), // Last 7 days
            }));
        });

        const { error: orderError } = await supabaseClient
            .from('orders')
            .insert(orders);

        if (orderError) throw orderError;

        // Update tenant flag
        await supabaseClient
            .from('tenants')
            .update({ demo_data_generated: true })
            .eq('id', tenant_id);

        return new Response(
            JSON.stringify({ success: true, message: 'Demo data generated successfully' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
