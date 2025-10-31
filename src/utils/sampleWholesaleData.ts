import { supabase } from "@/integrations/supabase/client";

export async function createSampleWholesaleData() {
  try {
    // Create sample clients
    const clients = [
      {
        business_name: "Big Mike's Operation",
        contact_name: "Mike Johnson",
        email: "mike@bigmikes.com",
        phone: "555-1234",
        address: "123 Brooklyn Ave, Brooklyn, NY 11201",
        client_type: "smoke_shop",
        credit_limit: 50000,
        outstanding_balance: 38000,
        payment_terms: 7,
        reliability_score: 68,
        monthly_volume: 45,
        status: "active"
      },
      {
        business_name: "Eastside Collective",
        contact_name: "Sarah Chen",
        email: "sarah@eastside.com",
        phone: "555-5678",
        address: "456 Manhattan St, Manhattan, NY 10001",
        client_type: "distributor",
        credit_limit: 100000,
        outstanding_balance: 0,
        payment_terms: 14,
        reliability_score: 98,
        monthly_volume: 62,
        status: "active"
      },
      {
        business_name: "South Bronx Connect",
        contact_name: "Carlos Rivera",
        email: "carlos@sbconnect.com",
        phone: "555-9012",
        address: "789 Bronx Blvd, Bronx, NY 10451",
        client_type: "bodega",
        credit_limit: 25000,
        outstanding_balance: 12000,
        payment_terms: 7,
        reliability_score: 75,
        monthly_volume: 28,
        status: "active"
      }
    ];

    const { data: clientData, error: clientError } = await supabase
      .from("wholesale_clients")
      .insert(clients)
      .select();

    if (clientError) throw clientError;

    // Create sample runners
    const runners = [
      {
        full_name: "Marcus Williams",
        phone: "555-7777",
        vehicle_type: "car",
        vehicle_plate: "NYK-1234",
        status: "available",
        rating: 4.9,
        total_deliveries: 87
      },
      {
        full_name: "DeShawn Carter",
        phone: "555-8888",
        vehicle_type: "suv",
        vehicle_plate: "NYK-5678",
        status: "available",
        rating: 4.7,
        total_deliveries: 72
      },
      {
        full_name: "Jamal Thompson",
        phone: "555-9999",
        vehicle_type: "car",
        vehicle_plate: "NYK-9012",
        status: "offline",
        rating: 4.8,
        total_deliveries: 45
      }
    ];

    const { data: runnerData, error: runnerError } = await supabase
      .from("wholesale_runners")
      .insert(runners)
      .select();

    if (runnerError) throw runnerError;

    // Create sample inventory
    const inventory = [
      {
        product_name: "Blue Dream",
        category: "Flower",
        warehouse_location: "Warehouse A",
        quantity_lbs: 45.5,
        quantity_units: 182,
        reorder_point: 20
      },
      {
        product_name: "Wedding Cake",
        category: "Flower",
        warehouse_location: "Warehouse A",
        quantity_lbs: 38.2,
        quantity_units: 153,
        reorder_point: 20
      },
      {
        product_name: "Gelato",
        category: "Flower",
        warehouse_location: "Warehouse B",
        quantity_lbs: 52.8,
        quantity_units: 211,
        reorder_point: 25
      },
      {
        product_name: "OG Kush",
        category: "Flower",
        warehouse_location: "Warehouse A",
        quantity_lbs: 11.3,
        quantity_units: 45,
        reorder_point: 20
      },
      {
        product_name: "Purple Haze",
        category: "Flower",
        warehouse_location: "Warehouse B",
        quantity_lbs: 67.5,
        quantity_units: 270,
        reorder_point: 30
      }
    ];

    const { error: inventoryError } = await supabase
      .from("wholesale_inventory")
      .insert(inventory);

    if (inventoryError) throw inventoryError;

    console.log("✅ Sample wholesale data created successfully!");
    console.log(`- ${clientData.length} clients created`);
    console.log(`- ${runnerData.length} runners created`);
    console.log(`- ${inventory.length} inventory items created`);

    return { success: true, clients: clientData, runners: runnerData };
  } catch (error) {
    console.error("❌ Error creating sample data:", error);
    throw error;
  }
}
