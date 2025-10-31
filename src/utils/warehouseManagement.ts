import { supabase } from "@/integrations/supabase/client";

export async function getWarehouseInventory(warehouseId: string) {
  const { data, error } = await supabase
    .from('warehouse_inventory')
    .select(`
      *,
      products (
        id,
        name,
        category,
        image_url
      )
    `)
    .eq('warehouse_id', warehouseId)
    .order('quantity_lbs', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function moveStock(
  fromWarehouseId: string,
  toWarehouseId: string,
  productId: string,
  quantity: number,
  notes?: string
) {
  // Start transaction
  const { data: fromInventory } = await supabase
    .from('warehouse_inventory')
    .select('quantity_lbs')
    .eq('warehouse_id', fromWarehouseId)
    .eq('product_id', productId)
    .single();

  if (!fromInventory || fromInventory.quantity_lbs < quantity) {
    throw new Error('Insufficient stock in source warehouse');
  }

  // Deduct from source warehouse
  await supabase
    .from('warehouse_inventory')
    .update({ 
      quantity_lbs: fromInventory.quantity_lbs - quantity 
    })
    .eq('warehouse_id', fromWarehouseId)
    .eq('product_id', productId);

  // Add to destination warehouse (or create if doesn't exist)
  const { data: toInventory } = await supabase
    .from('warehouse_inventory')
    .select('quantity_lbs, cost_per_lb')
    .eq('warehouse_id', toWarehouseId)
    .eq('product_id', productId)
    .single();

  if (toInventory) {
    await supabase
      .from('warehouse_inventory')
      .update({ 
        quantity_lbs: toInventory.quantity_lbs + quantity 
      })
      .eq('warehouse_id', toWarehouseId)
      .eq('product_id', productId);
  } else {
    // Get cost from source warehouse
    const { data: sourceCost } = await supabase
      .from('warehouse_inventory')
      .select('cost_per_lb')
      .eq('warehouse_id', fromWarehouseId)
      .eq('product_id', productId)
      .single();

    await supabase
      .from('warehouse_inventory')
      .insert({
        warehouse_id: toWarehouseId,
        product_id: productId,
        quantity_lbs: quantity,
        cost_per_lb: sourceCost?.cost_per_lb || 0
      });
  }

  // Log the movement
  await supabase.from('audit_logs').insert({
    entity_type: 'warehouse_transfer',
    action: 'TRANSFER',
    details: {
      from_warehouse: fromWarehouseId,
      to_warehouse: toWarehouseId,
      product_id: productId,
      quantity,
      notes
    }
  });

  return true;
}

export async function adjustInventoryCount(
  warehouseId: string,
  productId: string,
  newQuantity: number,
  reason: string
) {
  const { data: current } = await supabase
    .from('warehouse_inventory')
    .select('quantity_lbs')
    .eq('warehouse_id', warehouseId)
    .eq('product_id', productId)
    .single();

  const oldQuantity = current?.quantity_lbs || 0;
  const adjustment = newQuantity - oldQuantity;

  await supabase
    .from('warehouse_inventory')
    .update({ quantity_lbs: newQuantity })
    .eq('warehouse_id', warehouseId)
    .eq('product_id', productId);

  // Log adjustment
  await supabase.from('audit_logs').insert({
    entity_type: 'inventory_adjustment',
    action: 'UPDATE',
    details: {
      warehouse_id: warehouseId,
      product_id: productId,
      old_quantity: oldQuantity,
      new_quantity: newQuantity,
      adjustment,
      reason
    }
  });

  return { oldQuantity, newQuantity, adjustment };
}

export async function calculateInventoryValue(warehouseId: string): Promise<number> {
  const { data } = await supabase
    .from('warehouse_inventory')
    .select('quantity_lbs, cost_per_lb')
    .eq('warehouse_id', warehouseId);

  if (!data) return 0;

  return data.reduce((total, item) => {
    return total + (item.quantity_lbs * item.cost_per_lb);
  }, 0);
}

export async function checkLowStock(warehouseId: string, threshold: number = 20) {
  const { data, error } = await supabase
    .from('warehouse_inventory')
    .select(`
      *,
      products (name)
    `)
    .eq('warehouse_id', warehouseId)
    .lt('quantity_lbs', threshold)
    .order('quantity_lbs', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function generateRestockAlerts() {
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*');

  if (!warehouses) return [];

  const alerts = [];
  for (const warehouse of warehouses) {
    const lowStock = await checkLowStock(warehouse.id);
    for (const item of lowStock) {
      let severity: 'low' | 'very_low' | 'critical' = 'low';
      if (item.quantity_lbs < 10) severity = 'very_low';
      if (item.quantity_lbs < 5) severity = 'critical';

      alerts.push({
        warehouse_id: warehouse.id,
        warehouse_name: warehouse.name,
        product_id: item.product_id,
        product_name: item.products?.name,
        current_stock: item.quantity_lbs,
        severity
      });
    }
  }

  return alerts;
}

export async function getInventoryTurnover(productId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total sold in period
  const { data: sales } = await supabase
    .from('order_items')
    .select('quantity')
    .eq('product_id', productId)
    .gte('created_at', startDate.toISOString());

  const totalSold = sales?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Get average inventory
  const { data: inventory } = await supabase
    .from('warehouse_inventory')
    .select('quantity_lbs')
    .eq('product_id', productId);

  const avgInventory = inventory?.reduce((sum, item) => sum + item.quantity_lbs, 0) || 0;

  // Calculate turnover rate
  const turnoverRate = avgInventory > 0 ? totalSold / avgInventory : 0;

  return {
    totalSold,
    avgInventory,
    turnoverRate,
    daysToSellOut: turnoverRate > 0 ? Math.round(avgInventory / (totalSold / days)) : 0
  };
}
