import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, XCircle } from 'lucide-react';

const PERMISSION_CATEGORIES = [
  {
    name: 'Products',
    permissions: ['products.read', 'products.write', 'products.delete'],
  },
  {
    name: 'Orders',
    permissions: ['orders.read', 'orders.write', 'orders.delete'],
  },
  {
    name: 'Customers',
    permissions: ['customers.read', 'customers.write', 'customers.delete'],
  },
  {
    name: 'Inventory',
    permissions: ['inventory.read', 'inventory.write', 'inventory.delete'],
  },
  {
    name: 'Reports',
    permissions: ['reports.read', 'reports.export'],
  },
  {
    name: 'Settings',
    permissions: ['settings.read', 'settings.write'],
  },
];

export default function Permissions() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('roles' as any)
          .select('*, role_permissions(permission_key)')
          .eq('tenant_id', tenantId);

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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading permissions...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Permissions</h1>
        <p className="text-muted-foreground">Manage role-based permissions and access control</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {PERMISSION_CATEGORIES.map((category) => (
          <Card key={category.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {category.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {category.permissions.map((permission) => {
                  const hasPermission = roles?.some((role: any) =>
                    role.permissions.includes(permission)
                  );
                  return (
                    <div key={permission} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{permission}</span>
                      {hasPermission ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {roles && roles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>Permissions assigned to each role</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roles.map((role: any) => (
                <div key={role.id} className="border rounded-lg p-4">
                  <div className="font-medium mb-2">{role.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {(role.permissions || []).map((perm: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {perm}
                      </Badge>
                    ))}
                    {(!role.permissions || role.permissions.length === 0) && (
                      <span className="text-sm text-muted-foreground">No permissions</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

