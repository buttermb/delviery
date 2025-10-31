import { supabase } from "@/integrations/supabase/client";

export async function createSampleWholesaleData() {
  try {
    // Create sample clients with coordinates
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
        status: "active",
        coordinates: { lat: 40.6944, lng: -73.9865 }
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
        status: "active",
        coordinates: { lat: 40.7489, lng: -73.9680 }
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
        status: "active",
        coordinates: { lat: 40.8178, lng: -73.9251 }
      },
      {
        business_name: "Queens Network",
        contact_name: "David Park",
        email: "david@queensnet.com",
        phone: "555-3456",
        address: "321 Queens Blvd, Queens, NY 11375",
        client_type: "distributor",
        credit_limit: 75000,
        outstanding_balance: 18000,
        payment_terms: 7,
        reliability_score: 88,
        monthly_volume: 38,
        status: "active",
        coordinates: { lat: 40.7282, lng: -73.8075 }
      },
      {
        business_name: "West Village Supply",
        contact_name: "Amanda Torres",
        email: "amanda@wvs.com",
        phone: "555-7890",
        address: "567 Bleecker St, Manhattan, NY 10014",
        client_type: "smoke_shop",
        credit_limit: 35000,
        outstanding_balance: 8000,
        payment_terms: 7,
        reliability_score: 82,
        monthly_volume: 22,
        status: "active",
        coordinates: { lat: 40.7358, lng: -74.0036 }
      },
      {
        business_name: "Staten Island Depot",
        contact_name: "Tony Russo",
        email: "tony@sidepot.com",
        phone: "555-4567",
        address: "890 Victory Blvd, Staten Island, NY 10301",
        client_type: "bodega",
        credit_limit: 30000,
        outstanding_balance: 0,
        payment_terms: 14,
        reliability_score: 95,
        monthly_volume: 18,
        status: "active",
        coordinates: { lat: 40.6437, lng: -74.0854 }
      }
    ];

    const { data: clientData, error: clientError } = await supabase
      .from("wholesale_clients")
      .insert(clients)
      .select();

    if (clientError) {
      console.error("Client creation error:", clientError);
      throw new Error(`Failed to create clients: ${clientError.message}`);
    }
    
    if (!clientData || clientData.length === 0) {
      throw new Error("No client data returned");
    }
    
    console.log("Created clients:", clientData);

    // Create sample runners with coordinates
    const runners = [
      {
        full_name: "Marcus Williams",
        phone: "555-7777",
        vehicle_type: "car",
        vehicle_plate: "NYK-1234",
        status: "available",
        rating: 4.9,
        total_deliveries: 87,
        current_location: { lat: 40.7128, lng: -74.0060 }
      },
      {
        full_name: "DeShawn Carter",
        phone: "555-8888",
        vehicle_type: "suv",
        vehicle_plate: "NYK-5678",
        status: "available",
        rating: 4.7,
        total_deliveries: 72,
        current_location: { lat: 40.7580, lng: -73.9855 }
      },
      {
        full_name: "Jamal Thompson",
        phone: "555-9999",
        vehicle_type: "car",
        vehicle_plate: "NYK-9012",
        status: "offline",
        rating: 4.8,
        total_deliveries: 45,
        current_location: { lat: 40.6782, lng: -73.9442 }
      },
      {
        full_name: "Lisa Chen",
        phone: "555-2345",
        vehicle_type: "van",
        vehicle_plate: "NYK-3456",
        status: "available",
        rating: 4.9,
        total_deliveries: 93,
        current_location: { lat: 40.7489, lng: -73.9680 }
      },
      {
        full_name: "Andre Johnson",
        phone: "555-6789",
        vehicle_type: "car",
        vehicle_plate: "NYK-7890",
        status: "busy",
        rating: 4.6,
        total_deliveries: 65,
        current_location: { lat: 40.8448, lng: -73.8648 }
      }
    ];

    const { data: runnerData, error: runnerError } = await supabase
      .from("wholesale_runners")
      .insert(runners)
      .select();

    if (runnerError) {
      console.error("Runner creation error:", runnerError);
      throw new Error(`Failed to create runners: ${runnerError.message}`);
    }
    
    if (!runnerData || runnerData.length === 0) {
      throw new Error("No runner data returned");
    }
    
    console.log("Created runners:", runnerData);

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

    if (inventoryError) {
      console.error("Inventory creation error:", inventoryError);
      throw new Error(`Failed to create inventory: ${inventoryError.message}`);
    }

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
