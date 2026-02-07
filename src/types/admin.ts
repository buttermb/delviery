/**
 * Admin Panel Type Definitions
 * Centralized types for admin functionality
 */

// Product types
export interface AdminProduct {
  id: string;
  name: string;
  price: number;
  category: string | null;
  stock_quantity: number;
  thc_percent: number | null;
  image_url: string | null;
  sku?: string;
  brand?: string;
  strain_name?: string;
  cbd_percent?: number | null;
  batch_number?: string;
  cost_per_unit?: number;
  wholesale_price?: number;
  retail_price?: number;
  available_quantity?: number;
  in_stock?: boolean;
  tenant_id?: string;
}

// Customer types
export interface AdminCustomer {
  id: string;
  first_name: string;
  last_name: string;
  customer_type: string | null;
  loyalty_points: number;
  email?: string;
  phone?: string;
  address?: string;
  tenant_id?: string;
}

// Order types
export interface AdminOrder {
  id: string;
  order_number: string;
  customer_id: string;
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled' | 'completed';
  total_amount: number;
  created_at: string;
  tenant_id?: string;
}

// Wholesale Order types
export interface WholesaleOrder {
  id: string;
  order_number: string;
  client_id: string;
  status: 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
  total_amount: number;
  delivery_address: string;
  delivery_notes?: string;
  runner_id?: string;
  created_at: string;
  tenant_id?: string;
}

// Wholesale Client types
export interface WholesaleClient {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  client_type: 'smoke_shop' | 'bodega' | 'distributor' | 'other';
  credit_limit: number;
  outstanding_balance: number;
  status: 'active' | 'suspended' | 'inactive';
  tenant_id?: string;
}

// Inventory types
export interface InventoryItem {
  id: string;
  product_name: string;
  category: string;
  warehouse_location: string;
  quantity_lbs: number;
  quantity_units: number;
  reorder_point: number;
  cost_per_lb?: number;
  strain?: string;
  weight_lbs?: number;
  low_stock_threshold?: number;
  tenant_id?: string;
}

// Disposable Menu types - using actual database schema
import type { Database } from '@/integrations/supabase/types';

export type DisposableMenu = Database['public']['Tables']['disposable_menus']['Row'];

// Courier types
export interface Courier {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  rating: number;
  total_deliveries: number;
  commission_rate: number;
  tenant_id?: string;
}

// Stock Alert types
export interface StockAlert {
  id: string;
  product_id?: string;
  product_name: string;
  current_quantity: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  created_at: string;
  tenant_id?: string;
}

// Helper type for Supabase query responses
export type SupabaseResponse<T> = {
  data: T | null;
  error: Error | null;
};

// Helper type for paginated responses
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

