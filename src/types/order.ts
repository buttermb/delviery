/**
 * Order Type Definitions
 * Shared types for order-related operations across the codebase
 */

/**
 * Base Order interface for realtime and query operations
 */
export interface Order {
  id: string;
  status: string;
  tracking_code: string;
  total_amount: number;
  created_at: string;
  delivery_address: string;
  delivery_borough: string;
  tenant_id?: string;
  eta_minutes?: number;
  eta_updated_at?: string;
  courier_id?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  is_rush?: boolean;
  rushed_at?: string | null;
  rushed_by?: string | null;
  [key: string]: unknown;
}

/**
 * Order status enum for type safety
 */
export type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

/**
 * Order with full relations (merchants, addresses, couriers, order_items)
 */
export interface OrderWithRelations extends Order {
  merchants?: {
    business_name: string;
    address: string;
    phone: string;
  } | null;
  addresses?: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
  } | null;
  couriers?: {
    full_name: string;
    phone: string;
    email: string;
    vehicle_type: string;
    current_lat: number;
    current_lng: number;
  } | null;
  order_items?: OrderItem[];
}

/**
 * Order item type
 */
export interface OrderItem {
  quantity: number;
  price: number;
  product_name: string;
  products?: {
    name: string;
    image_url: string;
  } | null;
}

/**
 * Type guard for Order validation
 */
export function isOrder(value: unknown): value is Order {
  if (!value || typeof value !== 'object') {
    return false;
  }
  
  const o = value as Record<string, unknown>;
  
  return (
    typeof o.id === 'string' &&
    typeof o.status === 'string' &&
    typeof o.tracking_code === 'string' &&
    typeof o.total_amount === 'number' &&
    typeof o.created_at === 'string' &&
    typeof o.delivery_address === 'string' &&
    typeof o.delivery_borough === 'string'
  );
}

