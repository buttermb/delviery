/**
 * Role-Based Permissions System
 * Defines roles and their permissions
 */

export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  RUNNER: 'runner',
  WAREHOUSE: 'warehouse',
  VIEWER: 'viewer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const PERMISSIONS = {
  // Orders
  'orders:view': [ROLES.OWNER, ROLES.MANAGER, ROLES.RUNNER, ROLES.VIEWER],
  'orders:create': [ROLES.OWNER, ROLES.MANAGER],
  'orders:edit': [ROLES.OWNER, ROLES.MANAGER],
  'orders:delete': [ROLES.OWNER],
  'orders:cancel': [ROLES.OWNER, ROLES.MANAGER],

  // Inventory
  'inventory:view': [ROLES.OWNER, ROLES.MANAGER, ROLES.WAREHOUSE, ROLES.VIEWER],
  'inventory:edit': [ROLES.OWNER, ROLES.MANAGER, ROLES.WAREHOUSE],
  'inventory:transfer': [ROLES.OWNER, ROLES.MANAGER, ROLES.WAREHOUSE],
  'inventory:receive': [ROLES.OWNER, ROLES.MANAGER, ROLES.WAREHOUSE],
  'inventory:delete': [ROLES.OWNER],

  // Transfers & Delivery
  'transfers:view': [ROLES.OWNER, ROLES.MANAGER, ROLES.RUNNER, ROLES.WAREHOUSE, ROLES.VIEWER],
  'transfers:create': [ROLES.OWNER, ROLES.MANAGER],
  'transfers:edit': [ROLES.OWNER, ROLES.MANAGER],
  'transfers:assign': [ROLES.OWNER, ROLES.MANAGER],
  'transfers:complete': [ROLES.OWNER, ROLES.MANAGER, ROLES.RUNNER],

  // Menus
  'menus:view': [ROLES.OWNER, ROLES.MANAGER, ROLES.VIEWER],
  'menus:create': [ROLES.OWNER, ROLES.MANAGER],
  'menus:edit': [ROLES.OWNER, ROLES.MANAGER],
  'menus:burn': [ROLES.OWNER, ROLES.MANAGER],
  'menus:delete': [ROLES.OWNER],

  // Customers
  'customers:view': [ROLES.OWNER, ROLES.MANAGER, ROLES.VIEWER],
  'customers:create': [ROLES.OWNER, ROLES.MANAGER],
  'customers:edit': [ROLES.OWNER, ROLES.MANAGER],
  'customers:delete': [ROLES.OWNER],

  // Products
  'products:view': [ROLES.OWNER, ROLES.MANAGER, ROLES.WAREHOUSE, ROLES.VIEWER],
  'products:create': [ROLES.OWNER, ROLES.MANAGER],
  'products:edit': [ROLES.OWNER, ROLES.MANAGER],
  'products:delete': [ROLES.OWNER],

  // Financial
  'finance:view': [ROLES.OWNER, ROLES.MANAGER],
  'finance:edit': [ROLES.OWNER],
  'finance:payments': [ROLES.OWNER, ROLES.MANAGER],
  'finance:credit': [ROLES.OWNER, ROLES.MANAGER],
  'finance:reports': [ROLES.OWNER],

  // Team
  'team:view': [ROLES.OWNER, ROLES.MANAGER],
  'team:create': [ROLES.OWNER],
  'team:edit': [ROLES.OWNER, ROLES.MANAGER],
  'team:delete': [ROLES.OWNER],

  // Settings
  'settings:view': [ROLES.OWNER, ROLES.MANAGER],
  'settings:edit': [ROLES.OWNER],
  'settings:security': [ROLES.OWNER],
  'settings:integrations': [ROLES.OWNER],

  // Reports
  'reports:view': [ROLES.OWNER, ROLES.MANAGER, ROLES.VIEWER],
  'reports:export': [ROLES.OWNER, ROLES.MANAGER],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles ? allowedRoles.includes(role) : false;
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return Object.keys(PERMISSIONS).filter(perm =>
    PERMISSIONS[perm as Permission]?.includes(role)
  ) as Permission[];
}

