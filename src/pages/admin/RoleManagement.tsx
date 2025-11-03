import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Permission {
  key: string;
  label: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  user_count?: number;
  created_at: string;
}

const PERMISSIONS: Permission[] = [
  { key: 'orders.view', label: 'View Orders', category: 'Orders' },
  { key: 'orders.create', label: 'Create Orders', category: 'Orders' },
  { key: 'orders.edit', label: 'Edit Orders', category: 'Orders' },
  { key: 'orders.delete', label: 'Delete Orders', category: 'Orders' },
  { key: 'inventory.view', label: 'View Inventory', category: 'Inventory' },
  { key: 'inventory.create', label: 'Add Inventory', category: 'Inventory' },
  { key: 'inventory.edit', label: 'Edit Inventory', category: 'Inventory' },
  { key: 'inventory.delete', label: 'Delete Inventory', category: 'Inventory' },
  { key: 'customers.view', label: 'View Customers', category: 'Customers' },
  { key: 'customers.create', label: 'Create Customers', category: 'Customers' },
  { key: 'customers.edit', label: 'Edit Customers', category: 'Customers' },
  { key: 'customers.delete', label: 'Delete Customers', category: 'Customers' },
  { key: 'products.view', label: 'View Products', category: 'Products' },
  { key: 'products.create', label: 'Create Products', category: 'Products' },
  { key: 'products.edit', label: 'Edit Products', category: 'Products' },
  { key: 'products.delete', label: 'Delete Products', category: 'Products' },
  { key: 'reports.view', label: 'View Reports', category: 'Reports' },
  { key: 'settings.view', label: 'View Settings', category: 'Settings' },
  { key: 'settings.edit', label: 'Edit Settings', category: 'Settings' },
  { key: 'billing.view', label: 'View Billing', category: 'Billing' },
  { key: 'billing.edit', label: 'Manage Billing', category: 'Billing' },
];

const ROLE_TEMPLATES = {
  Manager: {
    name: 'Manager',
    description: 'Full access to operations, can manage team members',
    permissions: [
      'orders.view',
      'orders.create',
      'orders.edit',
      'inventory.view',
      'inventory.create',
      'inventory.edit',
      'customers.view',
      'customers.create',
      'customers.edit',
      'products.view',
      'products.create',
      'products.edit',
      'reports.view',
    ],
  },
  Cashier: {
    name: 'Cashier',
    description: 'Can process orders and view inventory',
    permissions: [
      'orders.view',
      'orders.create',
      'inventory.view',
      'customers.view',
      'customers.create',
      'products.view',
    ],
  },
  Driver: {
    name: 'Driver',
    description: 'Can view and update delivery orders',
    permissions: ['orders.view', 'orders.edit'],
  },
  Warehouse: {
    name: 'Warehouse',
    description: 'Can manage inventory and receiving',
    permissions: [
      'inventory.view',
      'inventory.create',
      'inventory.edit',
      'products.view',
      'products.edit',
    ],
  },
};

export default function RoleManagement() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: async (): Promise<Role[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('roles')
          .select('*, role_permissions(permission_key)')
          .eq('tenant_id', tenantId);

        if (error && error.code === '42P01') {
          // Table doesn't exist - return empty array
          return [];
        }
        if (error) throw error;

        // Get user counts
        const rolesWithCounts = await Promise.all(
          (data || []).map(async (role: any) => {
            const { count } = await supabase
              .from('tenant_users')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', tenantId)
              .eq('role', role.name);

            return {
              id: role.id,
              name: role.name,
              description: role.description || '',
              permissions: role.role_permissions?.map((p: any) => p.permission_key) || [],
              user_count: count || 0,
              created_at: role.created_at,
            };
          })
        );

        return rolesWithCounts;
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createRoleMutation = useMutation({
    mutationFn: async (role: Omit<Role, 'id' | 'created_at' | 'user_count'>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Create role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .insert({
          tenant_id: tenantId,
          name: role.name,
          description: role.description,
        })
        .select()
        .single();

      if (roleError) {
        if (roleError.code === '42P01') {
          throw new Error('Roles table does not exist. Please run database migrations.');
        }
        throw roleError;
      }

      // Create permissions
      if (role.permissions.length > 0) {
        const { error: permError } = await supabase.from('role_permissions').insert(
          role.permissions.map((perm) => ({
            role_id: roleData.id,
            permission_key: perm,
          }))
        );

        if (permError && permError.code !== '42P01') {
          throw permError;
        }
      }

      return roleData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
      toast({ title: 'Role created', description: 'Role has been successfully created.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create role',
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...role }: Role) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Update role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .update({
          name: role.name,
          description: role.description,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (roleError) {
        if (roleError.code === '42P01') {
          throw new Error('Roles table does not exist. Please run database migrations.');
        }
        throw roleError;
      }

      // Update permissions: delete old, insert new
      await supabase.from('role_permissions').delete().eq('role_id', id);

      if (role.permissions.length > 0) {
        const { error: permError } = await supabase.from('role_permissions').insert(
          role.permissions.map((perm) => ({
            role_id: id,
            permission_key: perm,
          }))
        );

        if (permError && permError.code !== '42P01') {
          throw permError;
        }
      }

      return roleData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
      toast({ title: 'Role updated', description: 'Role has been successfully updated.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete permissions first
      await supabase.from('role_permissions').delete().eq('role_id', id);
      // Then delete role
      const { error } = await supabase.from('roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', tenantId] });
      toast({ title: 'Role deleted', description: 'Role has been successfully deleted.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete role',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', permissions: [] });
    setEditingRole(null);
    setShowForm(false);
  };

  const handleUseTemplate = (template: typeof ROLE_TEMPLATES.Manager) => {
    setFormData({
      name: template.name,
      description: template.description,
      permissions: template.permissions,
    });
    setShowForm(true);
  };

  const handleTogglePermission = (permissionKey: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter((p) => p !== permissionKey)
        : [...prev.permissions, permissionKey],
    }));
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateRoleMutation.mutate({
        ...editingRole,
        ...formData,
      });
    } else {
      createRoleMutation.mutate(formData);
    }
  };

  const permissionsByCategory = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading roles...</div>
      </div>
    );
  }

  const rolesTableExists = roles !== undefined;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Create and manage user roles with granular permissions</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Role Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Role Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(ROLE_TEMPLATES).map(([key, template]) => (
              <Card key={key} className="cursor-pointer hover:bg-muted/50" onClick={() => handleUseTemplate(template)}>
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <Badge variant="outline" className="mt-2">
                    {template.permissions.length} permissions
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="mt-2 space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="font-semibold text-sm">{category}</h4>
                      <div className="grid grid-cols-2 gap-2 ml-4">
                        {perms.map((perm) => (
                          <div key={perm.key} className="flex items-center space-x-2">
                            <Checkbox
                              id={perm.key}
                              checked={formData.permissions.includes(perm.key)}
                              onCheckedChange={() => handleTogglePermission(perm.key)}
                            />
                            <Label htmlFor={perm.key} className="text-sm font-normal cursor-pointer">
                              {perm.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRoleMutation.isPending || updateRoleMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingRole ? 'Update' : 'Create'} Role
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Roles ({roles?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!rolesTableExists ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">Role management requires the roles and role_permissions tables to be created.</p>
              <p className="text-sm">Please run the database migration to create these tables.</p>
            </div>
          ) : roles && roles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{role.permissions.length} permissions</Badge>
                    </TableCell>
                    <TableCell>{role.user_count || 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(role)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
                              deleteRoleMutation.mutate(role.id);
                            }
                          }}
                          disabled={role.user_count && role.user_count > 0}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No roles created yet. Use a template or create a custom role.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

