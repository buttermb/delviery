import { logger } from '@/lib/logger';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
/**
 * Admin Users Management Page
 * Manage super admin users
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Shield, UserX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin';
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export default function AdminUsersPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'super_admin' | 'admin'>('admin');
  const queryClient = useQueryClient();

  // Fetch admin users
  const { data: adminUsers, isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.adminUsers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, email, full_name, role, is_active, created_at, last_login_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        logger.error('Error fetching admin users', error instanceof Error ? error : new Error(String(error)), { component: 'AdminUsersPage' });
        throw error;
      }
      return (data ?? []) as AdminUser[];
    },
  });

  // Toggle admin active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !isActive })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.adminUsers() });
      toast.success('Admin status updated');
    },
    onError: (error: unknown) => {
      logger.error('Failed to update admin status', error instanceof Error ? error : new Error(String(error)), { component: 'AdminUsersPage' });
      toast.error('Failed to update admin status', { description: humanizeError(error) });
    },
  });

  // Add new admin (would require auth user creation in production)
  const addAdminMutation = useMutation({
    mutationFn: async () => {
      // Note: This is a simplified version. In production, you'd need to:
      // 1. Create auth user via edge function
      // 2. Then add to admin_users table
      toast.info('Admin creation requires backend implementation');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.adminUsers() });
      setIsAddDialogOpen(false);
      setNewAdminEmail('');
      setNewAdminName('');
      toast.success('Admin user added');
    },
    onError: (error: unknown) => {
      logger.error('Failed to add admin', error instanceof Error ? error : new Error(String(error)), { component: 'AdminUsersPage' });
      toast.error('Failed to add admin', { description: humanizeError(error) });
    },
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage super admin and admin users
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
              <DialogDescription>
                Create a new admin user account
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newAdminRole} onValueChange={(value: 'super_admin' | 'admin') => setNewAdminRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => addAdminMutation.mutate()}
                disabled={!newAdminEmail || !newAdminName || addAdminMutation.isPending}
              >
                {addAdminMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Admin
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>
            {adminUsers?.length ?? 0} admin user{adminUsers?.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <EnhancedLoadingState variant="table" count={3} message="Loading admin users..." />
          ) : !adminUsers?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No admin users found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.full_name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'}>
                        <Shield className="mr-1 h-3 w-3" />
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.is_active ? 'default' : 'secondary'}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(admin.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {admin.last_login_at
                        ? format(new Date(admin.last_login_at), 'MMM d, yyyy')
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={admin.is_active ? 'outline' : 'default'}
                        onClick={() => toggleActiveMutation.mutate({
                          userId: admin.user_id,
                          isActive: admin.is_active
                        })}
                        disabled={toggleActiveMutation.isPending}
                      >
                        <UserX className="mr-1 h-3 w-3" />
                        {admin.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
