/**
 * Role-Based Permissions System
 * Defines comprehensive permission matrix for tenant admin roles
 * 
 * Roles:
 * - owner: Full access to all features
 * - admin: Most permissions except critical settings
 * - team_member (member): Limited permissions for day-to-day operations
 * - viewer: Read-only access
 */

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  TEAM_MEMBER: 'team_member', // Maps to 'member' in database
  VIEWER: 'viewer',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Permission format: resource:action
 * Examples: 'products:create', 'orders:view', 'team:invite'
 */
export type Permission = string;

/**
 * Comprehensive permission matrix
 * Maps each permission to roles that have access
 */
export const ROLE_PERMISSIONS: Record<Permission, Role[]> = {
  // Wildcard - owner has all permissions
  '*': [ROLES.OWNER],

  // Orders
  'orders:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER],
  'orders:create': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  'orders:edit': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  'orders:delete': [ROLES.OWNER, ROLES.ADMIN],
  'orders:cancel': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER],

  // Inventory
  'inventory:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER],
  'inventory:edit': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  'inventory:transfer': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  'inventory:receive': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER],
  'inventory:delete': [ROLES.OWNER, ROLES.ADMIN],

  // Products
  'products:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER],
  'products:create': [ROLES.OWNER, ROLES.ADMIN],
  'products:edit': [ROLES.OWNER, ROLES.ADMIN],
  'products:delete': [ROLES.OWNER, ROLES.ADMIN],

  // Customers
  'customers:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER],
  'customers:create': [ROLES.OWNER, ROLES.ADMIN],
  'customers:edit': [ROLES.OWNER, ROLES.ADMIN],
  'customers:delete': [ROLES.OWNER, ROLES.ADMIN],

  // Disposable Menus
  'menus:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER],
  'menus:create': [ROLES.OWNER, ROLES.ADMIN],
  'menus:edit': [ROLES.OWNER, ROLES.ADMIN],
  'menus:delete': [ROLES.OWNER, ROLES.ADMIN],
  'menus:share': [ROLES.OWNER, ROLES.ADMIN],

  // Wholesale Orders
  'wholesale-orders:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER],
  'wholesale-orders:create': [ROLES.OWNER, ROLES.ADMIN],
  'wholesale-orders:edit': [ROLES.OWNER, ROLES.ADMIN],
  'wholesale-orders:delete': [ROLES.OWNER, ROLES.ADMIN],

  // Financial
  'finance:view': [ROLES.OWNER, ROLES.ADMIN],
  'finance:edit': [ROLES.OWNER],
  'finance:payments': [ROLES.OWNER, ROLES.ADMIN],
  'finance:credit': [ROLES.OWNER, ROLES.ADMIN],
  'finance:reports': [ROLES.OWNER, ROLES.ADMIN],

  // Team Management
  'team:view': [ROLES.OWNER, ROLES.ADMIN],
  'team:invite': [ROLES.OWNER, ROLES.ADMIN],
  'team:edit': [ROLES.OWNER, ROLES.ADMIN],
  'team:remove': [ROLES.OWNER, ROLES.ADMIN],

  // Settings
  'settings:view': [ROLES.OWNER, ROLES.ADMIN],
  'settings:edit': [ROLES.OWNER],
  'settings:billing': [ROLES.OWNER],
  'settings:security': [ROLES.OWNER],
  'settings:integrations': [ROLES.OWNER],

  // Reports & Analytics
  'reports:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.VIEWER],
  'reports:export': [ROLES.OWNER, ROLES.ADMIN],

  // Fleet Management
  'fleet:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER],
  'fleet:manage': [ROLES.OWNER, ROLES.ADMIN],

  // API Access
  'api:view': [ROLES.OWNER, ROLES.ADMIN],
  'api:manage': [ROLES.OWNER],
} as const;

/**
 * Get all permissions for a specific role
 */
export function getRolePermissions(role: Role): Permission[] {
  if (role === ROLES.OWNER) {
    // Owner has all permissions (wildcard)
    return Object.keys(ROLE_PERMISSIONS) as Permission[];
  }

  return Object.entries(ROLE_PERMISSIONS)
    .filter(([_, allowedRoles]) => allowedRoles.includes(role))
    .map(([permission]) => permission as Permission);
}

/**
 * Check if a role has a specific permission
 */
export function hasRolePermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;

  // Owner has all permissions
  if (role === ROLES.OWNER) {
    return true;
  }

  const allowedRoles = ROLE_PERMISSIONS[permission];
  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(role);
}

/**
 * Map database role to system role
 * Database uses 'member', system uses 'team_member'
 */
export function mapDatabaseRoleToSystemRole(dbRole: string): Role {
  const roleMap: Record<string, Role> = {
    'owner': ROLES.OWNER,
    'admin': ROLES.ADMIN,
    'member': ROLES.TEAM_MEMBER,
    'team_member': ROLES.TEAM_MEMBER,
    'viewer': ROLES.VIEWER,
  };

  return roleMap[dbRole.toLowerCase()] || ROLES.VIEWER;
}

/**
 * Map system role to database role
 * Note: database uses 'member' for team_member, and includes 'super_admin'
 */
export function mapSystemRoleToDatabaseRole(systemRole: Role): string {
  const roleMap: Record<Role, string> = {
    [ROLES.OWNER]: 'owner',
    [ROLES.ADMIN]: 'admin',
    [ROLES.TEAM_MEMBER]: 'member',
    [ROLES.VIEWER]: 'viewer',
  };

  return roleMap[systemRole] || 'viewer';
}

