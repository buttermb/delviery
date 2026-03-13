import { Shield, ShieldCheck, UserCog, User, Truck, Eye } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Permission {
  label: string;
  allowed: boolean;
}

interface RoleDefinition {
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
  permissions: Permission[];
}

const ROLES: RoleDefinition[] = [
  {
    name: 'Super Admin',
    icon: ShieldCheck,
    description: 'Full system access across all tenants. Can manage platform-level settings, impersonate users, and access all data.',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    permissions: [
      { label: 'Manage tenants', allowed: true },
      { label: 'Impersonate users', allowed: true },
      { label: 'Platform settings', allowed: true },
      { label: 'View all data', allowed: true },
      { label: 'Manage billing', allowed: true },
      { label: 'Manage team', allowed: true },
    ],
  },
  {
    name: 'Tenant Admin',
    icon: Shield,
    description: 'Full access within a single tenant. Can manage settings, team members, billing, and all operational data.',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    permissions: [
      { label: 'Manage tenants', allowed: false },
      { label: 'Impersonate users', allowed: false },
      { label: 'Tenant settings', allowed: true },
      { label: 'View all data', allowed: true },
      { label: 'Manage billing', allowed: true },
      { label: 'Manage team', allowed: true },
    ],
  },
  {
    name: 'Manager',
    icon: UserCog,
    description: 'Operational management including orders, products, inventory, and customers. Cannot modify billing or team settings.',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    permissions: [
      { label: 'Manage orders', allowed: true },
      { label: 'Manage products', allowed: true },
      { label: 'Manage inventory', allowed: true },
      { label: 'Manage customers', allowed: true },
      { label: 'Manage billing', allowed: false },
      { label: 'Manage team', allowed: false },
    ],
  },
  {
    name: 'Staff',
    icon: User,
    description: 'Day-to-day operations access. Can process orders, view products and customers, and manage deliveries.',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    permissions: [
      { label: 'Process orders', allowed: true },
      { label: 'View products', allowed: true },
      { label: 'View customers', allowed: true },
      { label: 'Manage deliveries', allowed: true },
      { label: 'Edit products', allowed: false },
      { label: 'View analytics', allowed: false },
    ],
  },
  {
    name: 'Driver',
    icon: Truck,
    description: 'Delivery-focused access. Can view assigned orders and update delivery statuses. Limited to delivery operations.',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    permissions: [
      { label: 'View assigned orders', allowed: true },
      { label: 'Update delivery status', allowed: true },
      { label: 'View products', allowed: false },
      { label: 'View customers', allowed: false },
      { label: 'View analytics', allowed: false },
      { label: 'Manage settings', allowed: false },
    ],
  },
  {
    name: 'Viewer',
    icon: Eye,
    description: 'Read-only access to dashboards, orders, products, and reports. Cannot modify any data.',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    permissions: [
      { label: 'View dashboard', allowed: true },
      { label: 'View orders', allowed: true },
      { label: 'View products', allowed: true },
      { label: 'View reports', allowed: true },
      { label: 'Edit anything', allowed: false },
      { label: 'Manage settings', allowed: false },
    ],
  },
];

const PERMISSION_MATRIX_COLUMNS = [
  'Dashboard',
  'Orders',
  'Products',
  'Inventory',
  'Customers',
  'Analytics',
  'Settings',
  'Billing',
  'Team',
];

const PERMISSION_MATRIX: Record<string, Record<string, 'full' | 'view' | 'none'>> = {
  'Super Admin': { Dashboard: 'full', Orders: 'full', Products: 'full', Inventory: 'full', Customers: 'full', Analytics: 'full', Settings: 'full', Billing: 'full', Team: 'full' },
  'Tenant Admin': { Dashboard: 'full', Orders: 'full', Products: 'full', Inventory: 'full', Customers: 'full', Analytics: 'full', Settings: 'full', Billing: 'full', Team: 'full' },
  'Manager': { Dashboard: 'full', Orders: 'full', Products: 'full', Inventory: 'full', Customers: 'full', Analytics: 'view', Settings: 'view', Billing: 'none', Team: 'view' },
  'Staff': { Dashboard: 'view', Orders: 'full', Products: 'view', Inventory: 'view', Customers: 'view', Analytics: 'none', Settings: 'none', Billing: 'none', Team: 'none' },
  'Driver': { Dashboard: 'view', Orders: 'view', Products: 'none', Inventory: 'none', Customers: 'none', Analytics: 'none', Settings: 'none', Billing: 'none', Team: 'none' },
  'Viewer': { Dashboard: 'view', Orders: 'view', Products: 'view', Inventory: 'view', Customers: 'view', Analytics: 'view', Settings: 'none', Billing: 'none', Team: 'none' },
};

function AccessBadge({ level }: { level: 'full' | 'view' | 'none' }) {
  if (level === 'full') {
    return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">Full</Badge>;
  }
  if (level === 'view') {
    return <Badge variant="secondary" className="text-[10px]">View</Badge>;
  }
  return <span className="text-xs text-muted-foreground">--</span>;
}

export function AdminRoleDescriptions() {
  return (
    <div className="space-y-6">
      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLES.map((role) => {
          const Icon = role.icon;
          return (
            <Card key={role.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${role.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{role.name}</CardTitle>
                </div>
                <CardDescription className="mt-2">{role.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissions.map((perm) => (
                    <Badge
                      key={perm.label}
                      variant={perm.allowed ? 'default' : 'outline'}
                      className={perm.allowed ? '' : 'opacity-50 line-through'}
                    >
                      {perm.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <CardDescription>
            Overview of access levels for each role across system areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Role</th>
                  {PERMISSION_MATRIX_COLUMNS.map((col) => (
                    <th key={col} className="text-center py-2 px-2 font-medium text-xs">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES.map((role) => (
                  <tr key={role.name} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-sm">{role.name}</td>
                    {PERMISSION_MATRIX_COLUMNS.map((col) => (
                      <td key={col} className="text-center py-2.5 px-2">
                        <AccessBadge level={PERMISSION_MATRIX[role.name][col]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
