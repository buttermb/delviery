/**
 * Demo Data Generation
 * Generates sample products, customers, and menus for new tenants
 */

import { supabase } from '@/integrations/supabase/client';

interface DemoProduct {
  product_name: string;
  category: string;
  quantity_lbs: number;
  cost_per_lb?: number;
  price_per_lb?: number;
  status?: string;
}

interface DemoCustomer {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  client_type: string;
}

/**
 * Generate demo data for a new tenant
 */
export async function generateDemoData(tenantId: string): Promise<void> {
  try {
    // 1. Generate 10 cannabis strain products
    const products: DemoProduct[] = [
      {
        product_name: 'Blue Dream',
        category: 'Hybrid',
        quantity_lbs: 5,
        price_per_lb: 200,
        cost_per_lb: 150,
        status: 'active',
      },
      {
        product_name: 'OG Kush',
        category: 'Indica',
        quantity_lbs: 3,
        price_per_lb: 250,
        cost_per_lb: 180,
        status: 'active',
      },
      {
        product_name: 'Sour Diesel',
        category: 'Sativa',
        quantity_lbs: 4,
        price_per_lb: 180,
        cost_per_lb: 140,
        status: 'active',
      },
      {
        product_name: 'Girl Scout Cookies',
        category: 'Hybrid',
        quantity_lbs: 4,
        price_per_lb: 220,
        cost_per_lb: 165,
        status: 'active',
      },
      {
        product_name: 'Granddaddy Purple',
        category: 'Indica',
        quantity_lbs: 3,
        price_per_lb: 240,
        cost_per_lb: 175,
        status: 'active',
      },
      {
        product_name: 'Green Crack',
        category: 'Sativa',
        quantity_lbs: 5,
        price_per_lb: 190,
        cost_per_lb: 145,
        status: 'active',
      },
      {
        product_name: 'Pineapple Express',
        category: 'Hybrid',
        quantity_lbs: 4,
        price_per_lb: 200,
        cost_per_lb: 155,
        status: 'active',
      },
      {
        product_name: 'Northern Lights',
        category: 'Indica',
        quantity_lbs: 3,
        price_per_lb: 230,
        cost_per_lb: 170,
        status: 'active',
      },
      {
        product_name: 'White Widow',
        category: 'Hybrid',
        quantity_lbs: 4,
        price_per_lb: 210,
        cost_per_lb: 160,
        status: 'active',
      },
      {
        product_name: 'AK-47',
        category: 'Hybrid',
        quantity_lbs: 5,
        price_per_lb: 195,
        cost_per_lb: 148,
        status: 'active',
      },
    ];

    // Insert products
    const { data: insertedProducts, error: productsError } = await supabase
      .from('wholesale_inventory')
      .insert(
        products.map((p) => ({
          ...p,
          tenant_id: tenantId,
          quantity_units: 0,
          warehouse_location: 'Main Warehouse',
          reorder_point: 2,
        }))
      )
      .select('id');

    if (productsError) {
      console.error('Error inserting products:', productsError);
      throw productsError;
    }

    // 2. Generate 5 sample customers
    const customers: DemoCustomer[] = [
      {
        business_name: "John's Deli & Smoke Shop",
        contact_name: 'John Smith',
        email: 'john@demo-smokeshop.com',
        phone: '555-0101',
        address: '123 Main Street, New York, NY 10001',
        client_type: 'smoke_shop',
      },
      {
        business_name: 'Green Valley Distribution',
        contact_name: 'Sarah Johnson',
        email: 'sarah@demo-distribution.com',
        phone: '555-0102',
        address: '456 Commerce Ave, Los Angeles, CA 90001',
        client_type: 'distributor',
      },
      {
        business_name: 'Corner Bodega Express',
        contact_name: 'Mike Rodriguez',
        email: 'mike@demo-bodega.com',
        phone: '555-0103',
        address: '789 Street Corner, Brooklyn, NY 11201',
        client_type: 'bodega',
      },
      {
        business_name: 'Sunset Smoke Shop',
        contact_name: 'Emily Chen',
        email: 'emily@demo-sunset.com',
        phone: '555-0104',
        address: '321 Ocean Blvd, Miami, FL 33101',
        client_type: 'smoke_shop',
      },
      {
        business_name: 'Metro Wholesale Group',
        contact_name: 'David Williams',
        email: 'david@demo-metro.com',
        phone: '555-0105',
        address: '654 Business Park Dr, Chicago, IL 60601',
        client_type: 'distributor',
      },
    ];

    // Insert customers
    const { data: insertedCustomers, error: customersError } = await supabase
      .from('wholesale_clients')
      .insert(
        customers.map((c) => ({
          ...c,
          tenant_id: tenantId,
          credit_limit: 50000,
          outstanding_balance: 0,
          payment_terms: 30,
          reliability_score: 100,
          monthly_volume: 0,
          status: 'active',
        }))
      )
      .select('id');

    if (customersError) {
      console.error('Error inserting customers:', customersError);
      throw customersError;
    }

    // 3. Create 1 sample menu with 5 products
    // First, generate a unique token for the menu
    const menuToken = crypto.randomUUID().replace(/-/g, '');

    // Create the menu
    const menuData: any = {
      name: 'Demo Menu - Summer Collection',
      description: 'Curated selection of premium strains for summer',
      encrypted_url_token: menuToken,
      access_code_hash: 'demo_hash', // Demo menu, simplified access
      status: 'active',
      never_expires: false,
      expiration_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      security_settings: {},
      appearance_settings: {},
      min_order_quantity: 5,
      max_order_quantity: 50,
    };

    // Add tenant_id if column exists
    const { error: checkError } = await supabase
      .from('disposable_menus')
      .select('tenant_id')
      .limit(0);

    // If no error checking, tenant_id column exists
    if (!checkError || checkError.code !== '42703') {
      menuData.tenant_id = tenantId;
    }

    const { data: menu, error: menuError } = await supabase
      .from('disposable_menus')
      .insert(menuData)
      .select('id')
      .single();

    if (menuError) {
      console.error('Error creating menu:', menuError);
      throw menuError;
    }

    // Add 5 products to the menu (use first 5 products)
    if (insertedProducts && insertedProducts.length >= 5 && menu) {
      const { error: menuProductsError } = await supabase
        .from('disposable_menu_products')
        .insert(
          insertedProducts.slice(0, 5).map((product, index) => ({
            menu_id: menu.id,
            product_id: product.id,
            display_order: index,
            display_availability: true,
          }))
        );

      if (menuProductsError) {
        console.error('Error adding products to menu:', menuProductsError);
        throw menuProductsError;
      }
    }

    // 4. Update tenant usage counters (safely handle missing columns)
    try {
      const updateData: any = {};
      
      // Try to update usage if column exists
      try {
        const { error: usageCheck } = await supabase
          .from('tenants')
          .select('usage')
          .limit(0);
        
        if (!usageCheck || usageCheck.code !== '42703') {
          updateData.usage = {
            products: insertedProducts?.length || 0,
            customers: insertedCustomers?.length || 0,
            menus: 1,
          };
        }
      } catch {
        // Usage column doesn't exist, skip it
      }
      
      // Try to update demo_data_generated if column exists
      try {
        const { error: demoCheck } = await supabase
          .from('tenants')
          .select('demo_data_generated')
          .limit(0);
        
        if (!demoCheck || demoCheck.code !== '42703') {
          updateData.demo_data_generated = true;
        }
      } catch {
        // demo_data_generated column doesn't exist, skip it
      }
      
      // Only update if we have something to update
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('tenants')
          .update(updateData)
          .eq('id', tenantId);

        if (updateError && updateError.code !== '42703') {
          console.warn('Error updating tenant data (non-critical):', updateError);
          // Don't throw - this is not critical for demo data generation
        }
      }
    } catch (error) {
      console.warn('Error updating tenant usage (non-critical):', error);
      // Don't throw - demo data was created successfully
    }
  } catch (error) {
    console.error('Error generating demo data:', error);
    throw error;
  }
}

