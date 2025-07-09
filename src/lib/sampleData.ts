import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const createSampleData = async () => {
  try {
    // Sample products
    const products = [
      {
        sku: "WIDGET-001",
        name: "Standard Widget",
        description: "Basic widget for general use",
        unit_type: "each" as const,
        quantity: 5,
        min_stock_level: 10,
      },
      {
        sku: "WIDGET-002",
        name: "Premium Widget",
        description: "High-quality widget with advanced features",
        unit_type: "each" as const,
        quantity: 25,
        min_stock_level: 15,
      },
      {
        sku: "COMP-001",
        name: "Component A",
        description: "Essential component for assembly",
        unit_type: "box" as const,
        quantity: 8,
        min_stock_level: 20,
      },
      {
        sku: "COMP-002",
        name: "Component B",
        description: "Secondary component",
        unit_type: "box",
        quantity: 45,
        min_stock_level: 30,
      },
      {
        sku: "TOOL-001",
        name: "Assembly Tool",
        description: "Tool for widget assembly",
        unit_type: "each",
        quantity: 3,
        min_stock_level: 5,
      },
      {
        sku: "FASTENER-001",
        name: "Bolts M6x20",
        description: "Standard bolts for assembly",
        unit_type: "box",
        quantity: 150,
        min_stock_level: 100,
      },
      {
        sku: "FASTENER-002",
        name: "Screws M4x15",
        description: "Standard screws for assembly",
        unit_type: "box",
        quantity: 75,
        min_stock_level: 50,
      },
      {
        sku: "MATERIAL-001",
        name: "Steel Plate",
        description: "Raw material for manufacturing",
        unit_type: "kg",
        quantity: 500,
        min_stock_level: 200,
      },
      {
        sku: "MATERIAL-002",
        name: "Aluminum Rod",
        description: "Aluminum material for lightweight components",
        unit_type: "kg",
        quantity: 120,
        min_stock_level: 100,
      },
      {
        sku: "PACKAGING-001",
        name: "Standard Box",
        description: "Cardboard box for shipping",
        unit_type: "each",
        quantity: 2,
        min_stock_level: 50,
      },
      {
        sku: "PACKAGING-002",
        name: "Bubble Wrap",
        description: "Protective packaging material",
        unit_type: "case",
        quantity: 15,
        min_stock_level: 10,
      },
      {
        sku: "CABLE-001",
        name: "Power Cable",
        description: "Standard power cable",
        unit_type: "each",
        quantity: 75,
        min_stock_level: 25,
      },
      {
        sku: "ELECTRONICS-001",
        name: "Control Unit",
        description: "Electronic control unit",
        unit_type: "each",
        quantity: 12,
        min_stock_level: 8,
      },
      {
        sku: "SENSOR-001",
        name: "Temperature Sensor",
        description: "High-precision temperature sensor",
        unit_type: "each",
        quantity: 6,
        min_stock_level: 10,
      },
      {
        sku: "LUBRICANT-001",
        name: "Machine Oil",
        description: "Industrial lubricant",
        unit_type: "lbs",
        quantity: 25,
        min_stock_level: 15,
      },
    ];

    // Sample locations
    const locations = [
      { name: "DOCK-01", type: "dock" as const, capacity: 100, is_active: true },
      { name: "DOCK-02", type: "dock", capacity: 100, is_active: true },
      { name: "A1-01", type: "shelf", capacity: 50, is_active: true },
      { name: "A1-02", type: "shelf", capacity: 50, is_active: true },
      { name: "A1-03", type: "shelf", capacity: 50, is_active: true },
      { name: "A2-01", type: "shelf", capacity: 50, is_active: true },
      { name: "A2-02", type: "shelf", capacity: 50, is_active: true },
      { name: "B1-01", type: "bin", capacity: 25, is_active: true },
      { name: "B1-02", type: "bin", capacity: 25, is_active: true },
      { name: "B1-03", type: "bin", capacity: 25, is_active: true },
      { name: "B2-01", type: "bin", capacity: 25, is_active: true },
      { name: "B2-02", type: "bin", capacity: 25, is_active: true },
      { name: "STAGING-01", type: "staging", capacity: 200, is_active: true },
      { name: "STAGING-02", type: "staging", capacity: 200, is_active: true },
      { name: "QUARANTINE-01", type: "quarantine", capacity: 30, is_active: true },
    ];

    // Clear existing data
    await supabase.from("stock_movements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("pick_order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("pick_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("locations").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert sample data
    const { error: productsError } = await supabase.from("products").insert(products);
    if (productsError) throw productsError;

    const { error: locationsError } = await supabase.from("locations").insert(locations);
    if (locationsError) throw locationsError;

    // Get the inserted data to create relationships
    const { data: insertedProducts } = await supabase.from("products").select("id, sku, name");
    const { data: insertedLocations } = await supabase.from("locations").select("id, name, type");
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user || !insertedProducts || !insertedLocations) {
      throw new Error("Failed to get required data for sample movements");
    }

    // Create sample stock movements
    const sampleMovements = [];
    const now = new Date();
    
    // Create some historical movements
    for (let i = 0; i < 20; i++) {
      const randomProduct = insertedProducts[Math.floor(Math.random() * insertedProducts.length)];
      const randomLocation = insertedLocations[Math.floor(Math.random() * insertedLocations.length)];
      const movementTypes = ["receive", "putaway", "pick", "adjustment", "transfer"];
      const randomType = movementTypes[Math.floor(Math.random() * movementTypes.length)];
      const randomQuantity = Math.floor(Math.random() * 20) + 1;
      
      // Create movement timestamp within last 30 days
      const timestamp = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      
      sampleMovements.push({
        product_id: randomProduct.id,
        to_location_id: randomLocation.id,
        quantity: randomQuantity,
        movement_type: randomType,
        notes: `Sample ${randomType} movement for ${randomProduct.name}`,
        user_id: userData.user.id,
        timestamp: timestamp.toISOString(),
      });
    }

    const { error: movementsError } = await supabase.from("stock_movements").insert(sampleMovements);
    if (movementsError) throw movementsError;

    // Create sample pick orders
    const samplePickOrders = [
      {
        order_number: "PO-2024-001",
        status: "open" as const,
        priority: 2,
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: "Urgent order for production line",
      },
      {
        order_number: "PO-2024-002",
        status: "in_progress",
        priority: 1,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: "Standard weekly order",
      },
      {
        order_number: "PO-2024-003",
        status: "complete",
        priority: 3,
        due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: "Completed assembly order",
        completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const { data: insertedOrders, error: ordersError } = await supabase
      .from("pick_orders")
      .insert(samplePickOrders)
      .select();

    if (ordersError) throw ordersError;

    // Create sample pick order items
    const sampleOrderItems = [];
    insertedOrders?.forEach((order, orderIndex) => {
      const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items per order
      for (let i = 0; i < numItems; i++) {
        const randomProduct = insertedProducts[Math.floor(Math.random() * insertedProducts.length)];
        const randomLocation = insertedLocations[Math.floor(Math.random() * insertedLocations.length)];
        const requestedQty = Math.floor(Math.random() * 10) + 1;
        
        sampleOrderItems.push({
          pick_order_id: order.id,
          product_id: randomProduct.id,
          location_id: randomLocation.id,
          quantity_requested: requestedQty,
          quantity_picked: order.status === "complete" ? requestedQty : 
                          order.status === "in_progress" ? Math.floor(requestedQty * 0.7) : 0,
          is_completed: order.status === "complete",
        });
      }
    });

    const { error: itemsError } = await supabase.from("pick_order_items").insert(sampleOrderItems);
    if (itemsError) throw itemsError;

    toast.success("Sample data created successfully!");
    return true;
  } catch (error) {
    console.error("Error creating sample data:", error);
    toast.error("Failed to create sample data");
    return false;
  }
};