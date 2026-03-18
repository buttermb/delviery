/**
 * Delivery cost tracking types for P&L analysis
 */

export interface DeliveryCost {
  id: string;
  tenant_id: string;
  order_id: string;
  courier_id: string | null;
  runner_pay: number;
  fuel_estimate: number;
  time_cost: number;
  other_costs: number;
  total_cost: number;
  delivery_fee_collected: number;
  tip_amount: number;
  total_revenue: number;
  profit: number;
  distance_miles: number | null;
  delivery_time_minutes: number | null;
  delivery_zone: string | null;
  delivery_borough: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryCostWithOrder extends DeliveryCost {
  order_number?: string;
  order_status?: string;
  courier_name?: string;
}

export interface DeliveryCostInput {
  order_id: string;
  courier_id?: string | null;
  runner_pay: number;
  fuel_estimate: number;
  time_cost: number;
  other_costs?: number;
  delivery_fee_collected: number;
  tip_amount?: number;
  distance_miles?: number | null;
  delivery_time_minutes?: number | null;
  delivery_zone?: string | null;
  delivery_borough?: string | null;
  notes?: string | null;
}

export interface DeliveryPLSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  profitableCount: number;
  unprofitableCount: number;
  avgProfit: number;
  avgCostPerDelivery: number;
  avgRevenuePerDelivery: number;
}

export interface ZoneProfitability {
  zone: string;
  deliveryCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  avgDistanceMiles: number;
  avgDeliveryTimeMinutes: number;
  isProfitable: boolean;
}
