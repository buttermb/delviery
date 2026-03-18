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
    .filter(([, allowedRoles]) => allowedRoles.includes(role))
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

/**
 * Permission categories for organizing the permission matrix UI
 */
export interface PermissionCategory {
  name: string;
  description: string;
  permissions: {
    key: string;
    label: string;
    description: string;
  }[];
}

/**
 * Organized permission categories for the Role Management UI
 * Groups permissions by functional area with descriptions
 */
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    name: 'Orders',
    description: 'Manage customer orders and order processing',
    permissions: [
      { key: 'orders:view', label: 'View Orders', description: 'View order details and history' },
      { key: 'orders:create', label: 'Create Orders', description: 'Create new orders' },
      { key: 'orders:edit', label: 'Edit Orders', description: 'Modify existing orders' },
      { key: 'orders:delete', label: 'Delete Orders', description: 'Permanently delete orders' },
      { key: 'orders:cancel', label: 'Cancel Orders', description: 'Cancel pending orders' },
    ],
  },
  {
    name: 'Products',
    description: 'Manage product catalog and listings',
    permissions: [
      { key: 'products:view', label: 'View Products', description: 'View product details' },
      { key: 'products:create', label: 'Create Products', description: 'Add new products' },
      { key: 'products:edit', label: 'Edit Products', description: 'Modify product details' },
      { key: 'products:delete', label: 'Delete Products', description: 'Remove products' },
    ],
  },
  {
    name: 'Inventory',
    description: 'Manage stock levels and inventory operations',
    permissions: [
      { key: 'inventory:view', label: 'View Inventory', description: 'View stock levels' },
      { key: 'inventory:edit', label: 'Edit Inventory', description: 'Adjust stock quantities' },
      { key: 'inventory:transfer', label: 'Transfer Inventory', description: 'Move stock between locations' },
      { key: 'inventory:receive', label: 'Receive Inventory', description: 'Receive incoming shipments' },
      { key: 'inventory:delete', label: 'Delete Inventory', description: 'Remove inventory records' },
    ],
  },
  {
    name: 'Customers',
    description: 'Manage customer accounts and information',
    permissions: [
      { key: 'customers:view', label: 'View Customers', description: 'View customer details' },
      { key: 'customers:create', label: 'Create Customers', description: 'Add new customers' },
      { key: 'customers:edit', label: 'Edit Customers', description: 'Modify customer info' },
      { key: 'customers:delete', label: 'Delete Customers', description: 'Remove customer records' },
    ],
  },
  {
    name: 'Menus',
    description: 'Manage disposable menus for distribution',
    permissions: [
      { key: 'menus:view', label: 'View Menus', description: 'View menu details' },
      { key: 'menus:create', label: 'Create Menus', description: 'Create new menus' },
      { key: 'menus:edit', label: 'Edit Menus', description: 'Modify menu content' },
      { key: 'menus:delete', label: 'Delete Menus', description: 'Remove menus' },
      { key: 'menus:share', label: 'Share Menus', description: 'Share menus externally' },
    ],
  },
  {
    name: 'Wholesale',
    description: 'Manage B2B wholesale operations',
    permissions: [
      { key: 'wholesale-orders:view', label: 'View Wholesale Orders', description: 'View wholesale orders' },
      { key: 'wholesale-orders:create', label: 'Create Wholesale Orders', description: 'Create wholesale orders' },
      { key: 'wholesale-orders:edit', label: 'Edit Wholesale Orders', description: 'Modify wholesale orders' },
      { key: 'wholesale-orders:delete', label: 'Delete Wholesale Orders', description: 'Remove wholesale orders' },
    ],
  },
  {
    name: 'Finance',
    description: 'Access financial data and payments',
    permissions: [
      { key: 'finance:view', label: 'View Finance', description: 'View financial data' },
      { key: 'finance:edit', label: 'Edit Finance', description: 'Modify financial records' },
      { key: 'finance:payments', label: 'Manage Payments', description: 'Process payments' },
      { key: 'finance:credit', label: 'Manage Credit', description: 'Handle credit operations' },
      { key: 'finance:reports', label: 'Financial Reports', description: 'View financial reports' },
    ],
  },
  {
    name: 'Team',
    description: 'Manage team members and access',
    permissions: [
      { key: 'team:view', label: 'View Team', description: 'View team members' },
      { key: 'team:invite', label: 'Invite Members', description: 'Invite new team members' },
      { key: 'team:edit', label: 'Edit Members', description: 'Modify member details' },
      { key: 'team:remove', label: 'Remove Members', description: 'Remove team members' },
    ],
  },
  {
    name: 'Settings',
    description: 'Configure system settings',
    permissions: [
      { key: 'settings:view', label: 'View Settings', description: 'View system settings' },
      { key: 'settings:edit', label: 'Edit Settings', description: 'Modify system settings' },
      { key: 'settings:billing', label: 'Billing Settings', description: 'Manage billing' },
      { key: 'settings:security', label: 'Security Settings', description: 'Configure security' },
      { key: 'settings:integrations', label: 'Integrations', description: 'Manage integrations' },
    ],
  },
  {
    name: 'Reports',
    description: 'Access reports and analytics',
    permissions: [
      { key: 'reports:view', label: 'View Reports', description: 'View reports' },
      { key: 'reports:export', label: 'Export Reports', description: 'Export report data' },
    ],
  },
  {
    name: 'Fleet',
    description: 'Manage delivery fleet operations',
    permissions: [
      { key: 'fleet:view', label: 'View Fleet', description: 'View fleet status' },
      { key: 'fleet:manage', label: 'Manage Fleet', description: 'Configure fleet settings' },
    ],
  },
  {
    name: 'API',
    description: 'Manage API access and integrations',
    permissions: [
      { key: 'api:view', label: 'View API', description: 'View API settings' },
      { key: 'api:manage', label: 'Manage API', description: 'Configure API access' },
    ],
  },
];

/**
 * Get all available permissions as a flat list
 */
export function getAllPermissions(): string[] {
  return PERMISSION_CATEGORIES.flatMap(category =>
    category.permissions.map(p => p.key)
  );
}

/**
 * Get permission label by key
 */
export function getPermissionLabel(key: string): string {
  for (const category of PERMISSION_CATEGORIES) {
    const permission = category.permissions.find(p => p.key === key);
    if (permission) return permission.label;
  }
  return key;
}

