import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shield, Plus, Edit, Trash2 } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: string;
}

const PERMISSIONS = [
  'products.read', 'products.write', 'products.delete',
  'orders.read', 'orders.write', 'orders.delete',
  'customers.read', 'customers.write', 'customers.delete',
  'inventory.read', 'inventory.write', 'inventory.delete',
  'reports.read', 'settings.write',
];

export default function RoleManagement() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('roles' as any)
          .select('*, role_permissions(permission_key)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;

        return (data || []).map((role: any) => ({
          ...role,
          permissions: role.role_permissions?.map((rp: any) => rp.permission_key) || [],
        }));
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createRoleMutation = useMutation({
    mutationFn: async (role: Partial<Role>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data: roleData, error: roleError } = await supabase
        .from('roles' as any)
        .insert({
          tenant_id: tenantId,
          name: role.name,
          description: role.description || null,
        })
        .select()
        .single();

      if (roleError) {
        if (roleError.code === '42P01') {
          throw new Error('Roles table does not exist. Please run database migrations.');
        }
        throw roleError;
      }

      if (role.permissions && role.permissions.length > 0) {
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

      const { data: roleData, error: roleError } = await supabase
        .from('roles' as any)
        .update({
          name: role.name,
          description: role.description || null,
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

  const resetForm = () => {
    setFormData({ name: '', description: '', permissions: [] });
    setEditingRole(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || [],
    });
    setIsDialogOpen(true);
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

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading roles...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {roles && roles.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <CardTitle>{role.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{role.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Permissions:</div>
                  <div className="flex flex-wrap gap-2">
                    {role.permissions.length > 0 ? (
                      role.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary">
                          {perm}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No permissions</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No roles found. Create your first role to get started.
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
            <DialogDescription>
              Define role name, description, and permissions
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg max-h-64 overflow-y-auto">
                  {PERMISSIONS.map((permission) => (
                    <label key={permission} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                        className="rounded"
                      />
                      <span className="text-sm">{permission}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
              >
                {editingRole ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

