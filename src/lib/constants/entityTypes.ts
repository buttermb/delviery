/**
 * Entity Types Constants
 * Single source of truth for entity type definitions, labels, icons, and routes
 * Used for cross-module navigation and consistent entity handling
 */

/**
 * Entity types mapped to their database table names
 */
export const ENTITY_TYPES = {
  ORDER: 'orders',
  PRODUCT: 'products',
  CUSTOMER: 'customers',
  VENDOR: 'vendors',
  MENU: 'disposable_menus',
  DELIVERY: 'deliveries',
  PAYMENT: 'payments',
  INVENTORY: 'inventory',
  STOREFRONT: 'storefronts',
} as const;

export type EntityType = keyof typeof ENTITY_TYPES;
export type EntityTableName = (typeof ENTITY_TYPES)[EntityType];

/**
 * Human-readable display names for each entity type
 */
export const ENTITY_LABELS: Record<EntityType, string> = {
  ORDER: 'Order',
  PRODUCT: 'Product',
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
  MENU: 'Menu',
  DELIVERY: 'Delivery',
  PAYMENT: 'Payment',
  INVENTORY: 'Inventory',
  STOREFRONT: 'Storefront',
};

/**
 * Lucide-react icon names for each entity type
 * Use with dynamic icon rendering: import { icons } from 'lucide-react'
 * const IconComponent = icons[ENTITY_ICONS.ORDER]
 */
export const ENTITY_ICONS: Record<EntityType, string> = {
  ORDER: 'FileText',
  PRODUCT: 'Package',
  CUSTOMER: 'Users',
  VENDOR: 'Building2',
  MENU: 'Menu',
  DELIVERY: 'Truck',
  PAYMENT: 'CreditCard',
  INVENTORY: 'Warehouse',
  STOREFRONT: 'Store',
};

/**
 * Admin route patterns for each entity type
 * Use with tenant slug: `/${tenantSlug}${ENTITY_ROUTES.ORDER}/${entityId}`
 * These are relative to the admin section and include the /admin prefix
 */
export const ENTITY_ROUTES: Record<EntityType, string> = {
  ORDER: '/admin/orders',
  PRODUCT: '/admin/inventory-hub?tab=products&product=',
  CUSTOMER: '/admin/customers',
  VENDOR: '/admin/vendors',
  MENU: '/admin/disposable-menus',
  DELIVERY: '/admin/fulfillment-hub',
  PAYMENT: '/admin/finance-hub?tab=payments&payment=',
  INVENTORY: '/admin/inventory-hub',
  STOREFRONT: '/admin/storefront',
};

/**
 * Helper to get the full route URL for an entity
 * @param entityType - The type of entity
 * @param entityId - The entity's unique identifier
 * @param tenantSlug - The tenant's URL slug
 * @returns Full route URL including tenant prefix
 */
export function getEntityRoute(
  entityType: EntityType,
  entityId: string,
  tenantSlug: string
): string {
  const baseRoute = ENTITY_ROUTES[entityType];

  // Routes that use query params for entity ID
  if (baseRoute.includes('=')) {
    return `/${tenantSlug}${baseRoute}${entityId}`;
  }

  // Routes that use path params for entity ID
  return `/${tenantSlug}${baseRoute}/${entityId}`;
}

/**
 * Helper to get the table name for an entity type
 */
export function getEntityTableName(entityType: EntityType): EntityTableName {
  return ENTITY_TYPES[entityType];
}

/**
 * Helper to get the display label for an entity type
 */
export function getEntityLabel(entityType: EntityType): string {
  return ENTITY_LABELS[entityType];
}

/**
 * Helper to get the icon name for an entity type
 */
export function getEntityIconName(entityType: EntityType): string {
  return ENTITY_ICONS[entityType];
}
