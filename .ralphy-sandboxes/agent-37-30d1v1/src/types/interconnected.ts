/**
 * Interconnected Type Definitions
 * Shared interfaces that connect entities across modules for cross-module communication
 * Used throughout FloraIQ for unified data models
 */

import type { Order, OrderItem, OrderStatus } from '@/types/order';
import type { Product } from '@/types/product';

// ============================================================================
// Cross-Module Entity Types
// ============================================================================

/**
 * Order with full customer relationship
 */
export interface OrderWithCustomer extends Order {
  customer: CustomerSummary | null;
  customer_id: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

/**
 * Order with full product details for each line item
 */
export interface OrderWithProducts extends Order {
  items: OrderItemWithProduct[];
  product_count: number;
  unique_products: number;
}

/**
 * Extended order item with full product details
 */
export interface OrderItemWithProduct extends OrderItem {
  product: Product | null;
  product_id: string;
  sku?: string;
  category?: string;
  image_url?: string | null;
}

/**
 * Product with inventory levels across locations
 */
export interface ProductWithInventory extends Product {
  inventory: InventorySummary[];
  total_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  low_stock: boolean;
  out_of_stock: boolean;
}

/**
 * Inventory summary for a product at a location
 */
export interface InventorySummary {
  location_id: string;
  location_name: string;
  quantity: number;
  reserved: number;
  available: number;
  reorder_point?: number;
  last_restocked_at?: string;
}

/**
 * Customer with their order history summary
 */
export interface CustomerWithOrders {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  orders: OrderSummary[];
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  last_order_at: string | null;
  first_order_at: string | null;
  lifetime_value: number;
  loyalty_points?: number;
  loyalty_tier?: string;
}

/**
 * Minimal customer data for embedding in other entities
 */
export interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/**
 * Minimal order data for embedding in other entities
 */
export interface OrderSummary {
  id: string;
  order_number?: string;
  tracking_code: string;
  status: OrderStatus | string;
  total_amount: number;
  created_at: string;
  item_count: number;
}

/**
 * Vendor with their product catalog summary
 */
export interface VendorWithProducts {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  products: ProductSummary[];
  product_count: number;
  total_inventory_value: number;
  active_products: number;
  last_order_at: string | null;
  payment_terms?: string;
  status: 'active' | 'inactive' | 'pending';
}

/**
 * Minimal product data for embedding in other entities
 */
export interface ProductSummary {
  id: string;
  name: string;
  sku?: string;
  price: number | null;
  category?: string;
  in_stock: boolean;
  image_url?: string | null;
}

/**
 * Menu with its associated products
 */
export interface MenuWithProducts {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  slug: string;
  is_active: boolean;
  is_published: boolean;
  products: MenuProduct[];
  product_count: number;
  category_count: number;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  expires_at?: string | null;
}

/**
 * Product as it appears in a menu with ordering/display options
 */
export interface MenuProduct {
  id: string;
  product_id: string;
  product: ProductSummary;
  display_order: number;
  is_featured: boolean;
  custom_price?: number | null;
  custom_description?: string | null;
  is_available: boolean;
}

// ============================================================================
// Dashboard & Analytics Types
// ============================================================================

/**
 * Aggregated dashboard statistics
 */
export interface DashboardStats {
  // Orders
  orders_today: number;
  orders_this_week: number;
  orders_this_month: number;
  orders_pending: number;
  orders_in_transit: number;
  orders_completed_today: number;

  // Revenue
  revenue_today: number;
  revenue_this_week: number;
  revenue_this_month: number;
  average_order_value: number;

  // Inventory
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  inventory_value: number;

  // Customers
  total_customers: number;
  new_customers_today: number;
  new_customers_this_week: number;
  active_customers: number;

  // Deliveries
  active_deliveries: number;
  completed_deliveries_today: number;
  average_delivery_time: number;
  on_time_delivery_rate: number;

  // Computed timestamps
  last_updated_at: string;
  period_start: string;
  period_end: string;
}

/**
 * Partial dashboard stats for specific widgets
 */
export type PartialDashboardStats = Partial<DashboardStats>;

// ============================================================================
// Activity & Audit Types
// ============================================================================

/**
 * Standard activity log entry for audit trail
 */
export interface ActivityLogEntry {
  id: string;
  tenant_id: string;
  user_id: string | null;
  user_name?: string;
  user_email?: string;

  // Action info
  action: ActivityAction;
  entity_type: EntityType;
  entity_id: string | null;
  entity_name?: string;

  // Additional context
  metadata: Record<string, unknown>;
  description?: string;

  // IP/session tracking
  ip_address?: string;
  user_agent?: string;

  created_at: string;
}

/**
 * Supported activity actions
 */
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'viewed'
  | 'exported'
  | 'imported'
  | 'synced'
  | 'published'
  | 'unpublished'
  | 'archived'
  | 'restored'
  | 'assigned'
  | 'unassigned'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'logged_in'
  | 'logged_out';

/**
 * Entity types for activity logging and notifications
 */
export type EntityType =
  | 'order'
  | 'product'
  | 'inventory'
  | 'customer'
  | 'vendor'
  | 'menu'
  | 'storefront'
  | 'delivery'
  | 'courier'
  | 'invoice'
  | 'payment'
  | 'user'
  | 'team_member'
  | 'location'
  | 'category'
  | 'compliance'
  | 'notification'
  | 'setting'
  | 'integration';

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Notification payload for cross-module notifications
 */
export interface NotificationPayload {
  id: string;
  tenant_id: string;
  user_id: string | null;

  // Content
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;

  // Linkage
  entity_type: EntityType | null;
  entity_id: string | null;
  action_url?: string;

  // State
  read: boolean;
  read_at: string | null;
  dismissed: boolean;
  dismissed_at: string | null;

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
  expires_at?: string | null;
}

/**
 * Notification types
 */
export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'order'
  | 'inventory'
  | 'delivery'
  | 'payment'
  | 'system';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// ============================================================================
// Sync & Status Types
// ============================================================================

/**
 * Synchronization status for cross-module data sync
 */
export interface SyncStatus {
  id: string;
  tenant_id: string;

  // Sync target
  sync_type: SyncType;
  source: string;
  destination: string;

  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100

  // Counts
  total_records: number;
  processed_records: number;
  success_count: number;
  error_count: number;
  skipped_count: number;

  // Timing
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;

  // Metadata
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Types of synchronization operations
 */
export type SyncType =
  | 'inventory'
  | 'products'
  | 'orders'
  | 'customers'
  | 'menu'
  | 'storefront'
  | 'integration'
  | 'backup'
  | 'import'
  | 'export';

// ============================================================================
// Delivery & Logistics Types
// ============================================================================

/**
 * Delivery with full order and courier details
 */
export interface DeliveryWithDetails {
  id: string;
  tenant_id: string;
  order_id: string;
  order: OrderSummary;

  // Courier
  courier_id: string | null;
  courier: CourierSummary | null;

  // Addresses
  pickup_address: AddressInfo;
  delivery_address: AddressInfo;

  // Status & Timing
  status: DeliveryStatus;
  scheduled_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  estimated_delivery_at: string | null;

  // Tracking
  current_location?: GeoLocation;
  distance_km?: number;
  eta_minutes?: number;

  // Proof
  signature_url?: string | null;
  photo_proof_url?: string | null;
  delivery_notes?: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Minimal courier data for embedding
 */
export interface CourierSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  vehicle_type?: string;
  is_available: boolean;
  current_location?: GeoLocation;
}

/**
 * Standard address information
 */
export interface AddressInfo {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  lat?: number;
  lng?: number;
  notes?: string;
}

/**
 * Geographic location
 */
export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: string;
}

/**
 * Delivery status values
 */
export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'picking_up'
  | 'picked_up'
  | 'in_transit'
  | 'arriving'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'returned';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for OrderWithCustomer
 */
export function isOrderWithCustomer(order: unknown): order is OrderWithCustomer {
  if (!order || typeof order !== 'object') return false;
  const o = order as Record<string, unknown>;
  return 'id' in o && ('customer' in o || 'customer_id' in o);
}

/**
 * Type guard for ProductWithInventory
 */
export function isProductWithInventory(product: unknown): product is ProductWithInventory {
  if (!product || typeof product !== 'object') return false;
  const p = product as Record<string, unknown>;
  return 'id' in p && 'inventory' in p && Array.isArray(p.inventory);
}

/**
 * Type guard for ActivityLogEntry
 */
export function isActivityLogEntry(entry: unknown): entry is ActivityLogEntry {
  if (!entry || typeof entry !== 'object') return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.tenant_id === 'string' &&
    typeof e.action === 'string' &&
    typeof e.entity_type === 'string'
  );
}

/**
 * Type guard for NotificationPayload
 */
export function isNotificationPayload(notification: unknown): notification is NotificationPayload {
  if (!notification || typeof notification !== 'object') return false;
  const n = notification as Record<string, unknown>;
  return (
    typeof n.id === 'string' &&
    typeof n.tenant_id === 'string' &&
    typeof n.title === 'string' &&
    typeof n.type === 'string'
  );
}

/**
 * Type guard for SyncStatus
 */
export function isSyncStatus(status: unknown): status is SyncStatus {
  if (!status || typeof status !== 'object') return false;
  const s = status as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.tenant_id === 'string' &&
    typeof s.sync_type === 'string' &&
    typeof s.status === 'string'
  );
}
