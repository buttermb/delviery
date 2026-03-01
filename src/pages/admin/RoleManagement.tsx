import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Shield, Plus, Edit, Trash2, Users, Loader2, AlertTriangle } from 'lucide-react';
import { handleError } from '@/utils/errorHandling/handlers';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { logActivityAuto, ActivityActions } from '@/lib/activityLogger';
import { queryKeys } from '@/lib/queryKeys';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';

// Permission categories for UI organization
const PERMISSION_CATEGORIES = [
  { name: 'Orders', permissions: [{ key: 'orders.view', label: 'View Orders' }, { key: 'orders.create', label: 'Create Orders' }, { key: 'orders.edit', label: 'Edit Orders' }, { key: 'orders.delete', label: 'Delete Orders' }] },
  { name: 'Products', permissions: [{ key: 'products.view', label: 'View Products' }, { key: 'products.create', label: 'Create Products' }, { key: 'products.edit', label: 'Edit Products' }, { key: 'products.delete', label: 'Delete Products' }] },
  { name: 'Customers', permissions: [{ key: 'customers.view', label: 'View Customers' }, { key: 'customers.create', label: 'Create Customers' }, { key: 'customers.edit', label: 'Edit Customers' }, { key: 'customers.delete', label: 'Delete Customers' }] },
  { name: 'Inventory', permissions: [{ key: 'inventory.view', label: 'View Inventory' }, { key: 'inventory.adjust', label: 'Adjust Inventory' }] },
  { name: 'Reports', permissions: [{ key: 'reports.view', label: 'View Reports' }, { key: 'reports.export', label: 'Export Reports' }] },
  { name: 'Settings', permissions: [{ key: 'settings.view', label: 'View Settings' }, { key: 'settings.edit', label: 'Edit Settings' }] },
  { name: 'Team', permissions: [{ key: 'team.view', label: 'View Team' }, { key: 'team.invite', label: 'Invite Members' }, { key: 'team.manage', label: 'Manage Team' }] },
];

// Get human-readable permission label
function getPermissionLabel(permission: string): string {
  const parts = permission.split('.');
  if (parts.length !== 2) return permission;
  const action = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  return action;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  description: string;
  permissions: string[];
}

const initialFormData: FormData = {
  name: '',
  description: '',
  permissions: [],
};

export function RoleManagement() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Fetch roles with their permissions
  const { data: roles = [], isLoading, error } = useQuery({
    queryKey: queryKeys.roles.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('id, name, description, is_system, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (rolesError) {
          if (rolesError.code === '42P01') return []; // Table doesn't exist
          throw rolesError;
        }

        // Fetch permissions for each role
        const rolesWithPermissions = await Promise.all(
          (rolesData ?? []).map(async (role) => {
            const { data: permData } = await supabase
              .from('tenant_role_permissions')
              .select('permission')
              .eq('role_id', role.id)
              .eq('tenant_id', tenantId);

            return {
              ...role,
              permissions: (permData ?? []).map((p) => p.permission),
            };
          })
        );

        return rolesWithPermissions as Role[];
      } catch (err) {
        if (isPostgrestError(err) && err.code === '42P01') return [];
        throw err;
      }
    },
    enabled: !!tenantId,
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Create the role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .insert({
          tenant_id: tenantId,
          name: data.name.trim(),
          description: data.description.trim() || null,
          is_system: false,
        })
        .select()
        .maybeSingle();

      if (roleError) {
        if (roleError.code === '42P01') {
          throw new Error('Roles table does not exist. Please run database migrations.');
        }
        if (roleError.code === '23505') {
          throw new Error('A role with this name already exists.');
        }
        throw roleError;
      }

      // Add permissions
      if (data.permissions.length > 0) {
        const { error: permError } = await supabase
          .from('tenant_role_permissions')
          .insert(
            data.permissions.map((perm) => ({
              role_id: roleData.id,
              permission: perm,
              tenant_id: tenant?.id,
            }))
          );

        if (permError && permError.code !== '42P01') {
          throw permError;
        }
      }

      return roleData;
    },
    onSuccess: (roleData) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.byTenant(tenantId) });
      toast.success("Role has been successfully created.");

      // Log activity for audit trail
      if (tenantId && roleData) {
        logActivityAuto(
          tenantId,
          ActivityActions.CREATE_ROLE,
          'role',
          (roleData as { id: string }).id,
          {
            role_name: formData.name,
            description: formData.description,
            permissions_count: formData.permissions.length,
            permissions: formData.permissions,
          }
        );
      }

      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'RoleManagement.createRole',
        toastTitle: 'Failed to create role',
        showToast: true,
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Update the role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .update({
          name: data.name.trim(),
          description: data.description.trim() || null,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (roleError) {
        if (roleError.code === '23505') {
          throw new Error('A role with this name already exists.');
        }
        throw roleError;
      }

      // Delete existing permissions and add new ones
      await supabase.from('tenant_role_permissions').delete().eq('role_id', id).eq('tenant_id', tenantId);

      if (data.permissions.length > 0) {
        const { error: permError } = await supabase
          .from('tenant_role_permissions')
          .insert(
            data.permissions.map((perm) => ({
              role_id: id,
              permission: perm,
              tenant_id: tenant?.id,
            }))
          );

        if (permError && permError.code !== '42P01') {
          throw permError;
        }
      }

      return roleData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.byTenant(tenantId) });
      toast.success("Role has been successfully updated.");

      // Log activity for audit trail
      if (tenantId && editingRole) {
        logActivityAuto(
          tenantId,
          ActivityActions.UPDATE_ROLE,
          'role',
          editingRole.id,
          {
            role_name: formData.name,
            previous_name: editingRole.name,
            description: formData.description,
            permissions_count: formData.permissions.length,
            permissions: formData.permissions,
            previous_permissions: editingRole.permissions,
          }
        );
      }

      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'RoleManagement.updateRole',
        toastTitle: 'Failed to update role',
        showToast: true,
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('tenant_id', tenantId)
        .eq('is_system', false); // Only allow deleting non-system roles

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.byTenant(tenantId) });
      toast.success("The role has been deleted successfully.");
      setRoleToDelete(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      handleError(error, {
        component: 'RoleManagement.deleteRole',
        toastTitle: 'Failed to delete role',
        showToast: true,
      });
    },
  });

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setEditingRole(null);
    setIsDialogOpen(false);
    setExpandedCategories([]);
  }, []);

  const handleEdit = useCallback((role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions ?? [],
    });
    // Expand categories that have selected permissions
    const categoriesWithSelections = PERMISSION_CATEGORIES.filter((cat) =>
      cat.permissions.some((p) => (role.permissions ?? []).includes(p.key))
    ).map((cat) => cat.name);
    setExpandedCategories(categoriesWithSelections);
    setIsDialogOpen(true);
  }, []);

  const handleDelete = useCallback((role: Role) => {
    setRoleToDelete(role);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Role name is required");
      return;
    }

    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data: formData });
    } else {
      createRoleMutation.mutate(formData);
    }
  };

  const togglePermission = useCallback((permissionKey: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter((p) => p !== permissionKey)
        : [...prev.permissions, permissionKey],
    }));
  }, []);

  const toggleCategory = useCallback((categoryName: string, permissions: string[]) => {
    const allSelected = permissions.every((p) => formData.permissions.includes(p));
    setFormData((prev) => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter((p) => !permissions.includes(p))
        : [...new Set([...prev.permissions, ...permissions])],
    }));
  }, [formData.permissions]);

  const getCategorySelectionState = useCallback(
    (permissions: string[]): 'all' | 'some' | 'none' => {
      const selectedCount = permissions.filter((p) => formData.permissions.includes(p)).length;
      if (selectedCount === 0) return 'none';
      if (selectedCount === permissions.length) return 'all';
      return 'some';
    },
    [formData.permissions]
  );

  const columns = useMemo<ResponsiveColumn<Role>[]>(
    () => [
      {
        header: 'Role Name',
        accessorKey: 'name',
        cell: (role) => (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{role.name}</span>
            {role.is_system && (
              <Badge variant="secondary" className="text-xs">
                System
              </Badge>
            )}
          </div>
        ),
      },
      {
        header: 'Description',
        accessorKey: 'description',
        cell: (role) => (
          <span className="text-muted-foreground text-sm">
            {role.description || 'No description'}
          </span>
        ),
      },
      {
        header: 'Permissions',
        cell: (role) => {
          if (!role.permissions?.length) {
            return <span className="text-xs text-muted-foreground">No permissions</span>;
          }

          const displayCount = 3;
          const visiblePermissions = role.permissions.slice(0, displayCount);
          const remainingCount = role.permissions.length - displayCount;

          return (
            <div className="flex flex-wrap gap-1 items-center">
              {visiblePermissions.map((p) => (
                <Badge key={p} variant="outline" className="text-xs font-normal">
                  {getPermissionLabel(p)}
                </Badge>
              ))}
              {remainingCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs cursor-help">
                        +{remainingCount} more
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="flex flex-col gap-1 text-xs">
                        {role.permissions.slice(displayCount).map((p) => (
                          <div key={p}>{getPermissionLabel(p)}</div>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
      {
        header: 'Actions',
        cell: (role) => (
          <div className="flex items-center gap-1 justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit role</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {!role.is_system && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(role)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete role</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ),
      },
    ],
    [handleEdit, handleDelete]
  );

  const isSubmitting = createRoleMutation.isPending || updateRoleMutation.isPending;

  if (isLoading) {
    return <EnhancedLoadingState variant="table" message="Loading roles..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Failed to load roles. Please try again.</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.roles.byTenant(tenantId) })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage custom roles with specific permissions for your team
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Roles Table */}
      <Card>
        <CardContent className="p-0">
          <ResponsiveTable
            columns={columns}
            data={roles}
            keyExtractor={(role) => role.id}
            emptyState={{
              title: 'No roles found',
              description: 'Create your first custom role to control team member permissions.',
              icon: Users,
            }}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {editingRole ? 'Edit Role' : 'Create Role'}
            </DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Modify the role name, description, and permissions.'
                : 'Define a new role with specific permissions for your team members.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Role Name *</Label>
                  <Input
                    id="role-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Sales Manager"
                    disabled={editingRole?.is_system}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-description">Description</Label>
                  <Input
                    id="role-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this role"
                  />
                </div>
              </div>

              {/* Permission Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Permissions</Label>
                  <span className="text-sm text-muted-foreground">
                    {formData.permissions.length} selected
                  </span>
                </div>

                <Accordion
                  type="multiple"
                  value={expandedCategories}
                  onValueChange={setExpandedCategories}
                  className="space-y-2"
                >
                  {PERMISSION_CATEGORIES.map((category) => {
                    const permissionKeys = category.permissions.map((p) => p.key);
                    const selectionState = getCategorySelectionState(permissionKeys);
                    const selectedCount = category.permissions.filter((p) =>
                      formData.permissions.includes(p.key)
                    ).length;

                    return (
                      <AccordionItem
                        key={category.name}
                        value={category.name}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline py-3">
                          <div className="flex items-center gap-3 flex-1">
                            <Checkbox
                              checked={selectionState === 'all'}
                              ref={(el) => {
                                if (el) {
                                  (el as HTMLButtonElement & { indeterminate?: boolean }).indeterminate =
                                    selectionState === 'some';
                                }
                              }}
                              onCheckedChange={() =>
                                toggleCategory(category.name, permissionKeys)
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="font-medium text-sm">{category.name}</span>
                              <span className="text-xs text-muted-foreground font-normal">
                                {category.permissions.length} permissions
                              </span>
                            </div>
                            <Badge variant="secondary" className="ml-auto mr-2 text-xs">
                              {selectedCount}/{category.permissions.length}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="grid gap-2 sm:grid-cols-2 pl-7">
                            {category.permissions.map((permission) => {
                              const isSelected = formData.permissions.includes(permission.key);
                              return (
                                <label
                                  key={permission.key}
                                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => togglePermission(permission.key)}
                                    className="mt-0.5"
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium leading-none">
                                      {permission.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {permission.key}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </div>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (roleToDelete) {
            deleteRoleMutation.mutate(roleToDelete.id);
          }
        }}
        itemType="role"
        itemName={roleToDelete?.name}
        description={`Are you sure you want to delete the role "${roleToDelete?.name}"? This action cannot be undone. Team members assigned to this role will lose these permissions.`}
        isLoading={deleteRoleMutation.isPending}
      />
    </div>
  );
}

// Named export only (no default export per project conventions)
export default RoleManagement;
