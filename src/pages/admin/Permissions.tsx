import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Save, Users, Shield, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Permission {
  key: string;
  name: string;
  category: string;
  description: string;
}

interface RolePermission {
  role_id: string;
  role_name: string;
  permission_key: string;
  granted: boolean;
}

interface UserPermission {
  user_id: string;
  user_name: string;
  permission_key: string;
  granted: boolean;
  source: 'role' | 'direct';
}

const PERMISSIONS: Permission[] = [
  // Orders
  { key: 'orders.view', name: 'View Orders', category: 'Orders', description: 'View all orders' },
  { key: 'orders.create', name: 'Create Orders', category: 'Orders', description: 'Create new orders' },
  { key: 'orders.edit', name: 'Edit Orders', category: 'Orders', description: 'Modify existing orders' },
  { key: 'orders.delete', name: 'Delete Orders', category: 'Orders', description: 'Delete orders' },
  { key: 'orders.approve', name: 'Approve Orders', category: 'Orders', description: 'Approve pending orders' },
  
  // Inventory
  { key: 'inventory.view', name: 'View Inventory', category: 'Inventory', description: 'View inventory levels' },
  { key: 'inventory.create', name: 'Add Inventory', category: 'Inventory', description: 'Add new inventory items' },
  { key: 'inventory.edit', name: 'Edit Inventory', category: 'Inventory', description: 'Modify inventory' },
  { key: 'inventory.delete', name: 'Delete Inventory', category: 'Inventory', description: 'Remove inventory items' },
  { key: 'inventory.transfer', name: 'Transfer Inventory', category: 'Inventory', description: 'Transfer between locations' },
  
  // Customers
  { key: 'customers.view', name: 'View Customers', category: 'Customers', description: 'View customer list' },
  { key: 'customers.create', name: 'Create Customers', category: 'Customers', description: 'Add new customers' },
  { key: 'customers.edit', name: 'Edit Customers', category: 'Customers', description: 'Modify customer data' },
  { key: 'customers.delete', name: 'Delete Customers', category: 'Customers', description: 'Remove customers' },
  
  // Products
  { key: 'products.view', name: 'View Products', category: 'Products', description: 'View product catalog' },
  { key: 'products.create', name: 'Create Products', category: 'Products', description: 'Add new products' },
  { key: 'products.edit', name: 'Edit Products', category: 'Products', description: 'Modify products' },
  { key: 'products.delete', name: 'Delete Products', category: 'Products', description: 'Remove products' },
  
  // Reports
  { key: 'reports.view', name: 'View Reports', category: 'Reports', description: 'View all reports' },
  { key: 'reports.export', name: 'Export Reports', category: 'Reports', description: 'Export report data' },
  
  // Settings
  { key: 'settings.view', name: 'View Settings', category: 'Settings', description: 'View system settings' },
  { key: 'settings.edit', name: 'Edit Settings', category: 'Settings', description: 'Modify system settings' },
  { key: 'settings.billing', name: 'Manage Billing', category: 'Settings', description: 'Access billing settings' },
  
  // Users
  { key: 'users.view', name: 'View Users', category: 'Users', description: 'View user list' },
  { key: 'users.create', name: 'Create Users', category: 'Users', description: 'Add new users' },
  { key: 'users.edit', name: 'Edit Users', category: 'Users', description: 'Modify user accounts' },
  { key: 'users.delete', name: 'Delete Users', category: 'Users', description: 'Remove users' },
  
  // Admin
  { key: 'admin.full_access', name: 'Full Admin Access', category: 'Admin', description: 'Complete system access' },
];

export default function Permissions() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [rolePermissions, setRolePermissions] = useState<Record<string, Set<string>>>({});
  const [userPermissions, setUserPermissions] = useState<Record<string, Set<string>>>({});

  const { data: roles } = useQuery({
    queryKey: ['roles-for-permissions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('roles')
          .select('id, name')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const { data: users } = useQuery({
    queryKey: ['users-for-permissions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('tenant_users')
          .select('id, name, email, role')
          .eq('tenant_id', tenantId)
          .limit(100);

        if (error) throw error;
        return data || [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!tenantId,
  });

  const { data: rolePermissionsData } = useQuery({
    queryKey: ['role-permissions', tenantId, selectedRole],
    queryFn: async (): Promise<RolePermission[]> => {
      if (!tenantId || !selectedRole) return [];

      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('*, roles(name)')
          .eq('role_id', selectedRole);

        if (error && error.code === '42P01') return [];
        if (error) throw error;

        return (data || []).map((rp: any) => ({
          role_id: rp.role_id,
          role_name: rp.roles?.name || 'Unknown',
          permission_key: rp.permission_key,
          granted: true,
        }));
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId && !!selectedRole,
  });

  const saveRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissions }: { roleId: string; permissions: string[] }) => {
      // Delete existing permissions
      await supabase.from('role_permissions').delete().eq('role_id', roleId);

      // Insert new permissions
      if (permissions.length > 0) {
        const { error } = await supabase.from('role_permissions').insert(
          permissions.map((perm) => ({
            role_id: roleId,
            permission_key: perm,
          }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions', tenantId, selectedRole] });
      toast({ title: 'Permissions saved', description: 'Role permissions have been updated.' });
    },
  });

  const permissionsByCategory = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const currentRolePerms = rolePermissionsData?.map((rp) => rp.permission_key) || [];
  const rolePermsSet = new Set(currentRolePerms);

  const handleTogglePermission = (permissionKey: string) => {
    if (rolePermsSet.has(permissionKey)) {
      rolePermsSet.delete(permissionKey);
    } else {
      rolePermsSet.add(permissionKey);
    }

    if (selectedRole) {
      saveRolePermissionsMutation.mutate({
        roleId: selectedRole,
        permissions: Array.from(rolePermsSet),
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Permissions</h1>
          <p className="text-muted-foreground">Manage granular permissions and access control</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{PERMISSIONS.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList>
          <TabsTrigger value="roles">Role Permissions</TabsTrigger>
          <TabsTrigger value="users">User Permissions</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Permissions to Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="role-select">Select Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="role-select">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRole && (
                <div className="space-y-6 max-h-[600px] overflow-y-auto border rounded-lg p-4">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase">{category}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-4">
                        {perms.map((perm) => (
                          <div key={perm.key} className="flex items-start space-x-2">
                            <Checkbox
                              id={perm.key}
                              checked={rolePermsSet.has(perm.key)}
                              onCheckedChange={() => handleTogglePermission(perm.key)}
                              disabled={saveRolePermissionsMutation.isPending}
                            />
                            <div className="flex-1">
                              <Label htmlFor={perm.key} className="cursor-pointer font-normal">
                                {perm.name}
                              </Label>
                              <p className="text-xs text-muted-foreground">{perm.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!selectedRole && (
                <div className="text-center py-8 text-muted-foreground">
                  Select a role to manage permissions
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>User-Specific Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user-select">Select User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger id="user-select">
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedUser && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm text-muted-foreground">
                        User-specific permissions override role permissions. Use with caution.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Direct user permission management will be available in the next update.
                    </p>
                  </div>
                )}

                {!selectedUser && (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a user to manage individual permissions
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Permission</TableHead>
                      {roles?.map((role) => (
                        <TableHead key={role.id} className="text-center">
                          {role.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSIONS.map((perm) => (
                      <TableRow key={perm.key}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{perm.name}</div>
                            <div className="text-xs text-muted-foreground">{perm.category}</div>
                          </div>
                        </TableCell>
                        {roles?.map((role) => {
                          const hasPermission = rolePermissionsData
                            ?.some((rp) => rp.role_id === role.id && rp.permission_key === perm.key);
                          return (
                            <TableCell key={role.id} className="text-center">
                              {hasPermission ? (
                                <Badge variant="default">✓</Badge>
                              ) : (
                                <Badge variant="outline">—</Badge>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Permission Inheritance Info */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Inheritance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              • Permissions are inherited from roles. Users with a role automatically have all permissions assigned to that role.
            </p>
            <p>
              • Direct user permissions override role permissions for specific cases.
            </p>
            <p>
              • Permission changes take effect immediately for all users with that role.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

