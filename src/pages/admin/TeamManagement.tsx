import { logger } from '@/lib/logger';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Plus, MoreHorizontal, Shield, AlertTriangle, AlertCircle, UserCheck, UserX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { formatSmartDate } from '@/lib/formatters';
import { SEOHead } from '@/components/SEOHead';
import { usePermissions } from '@/hooks/usePermissions';
import { PendingInvitations } from '@/components/admin/PendingInvitations';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'suspended' | 'deleted';
  avatar_url: string | null;
  created_at: string;
  last_login_at: string | null;
  is_owner?: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  token: string;
}

interface InviteFormData {
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'member' | 'viewer';
}

const initialFormData: InviteFormData = {
  email: '',
  first_name: '',
  last_name: '',
  role: 'member',
};

export default function TeamManagement() {
  const { tenant, loading: authLoading } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { canEdit, canDelete } = usePermissions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);
  const [formData, setFormData] = useState<InviteFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InviteFormData, string>>>({});

  // Fetch team members with TanStack Query
  const {
    data: teamMembers = [],
    isLoading: loadingMembers,
    error: membersError,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: queryKeys.team.members(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data: tenantUsers, error } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenant.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Add owner as first member
      const ownerData: TeamMember = {
        id: 'owner',
        user_id: 'owner',
        email: tenant.slug,
        first_name: 'Business',
        last_name: 'Owner',
        full_name: 'Business Owner',
        role: 'owner',
        status: 'active',
        avatar_url: null,
        created_at: tenant.created_at || new Date().toISOString(),
        last_login_at: null,
        is_owner: true,
      };

      const members = (tenantUsers ?? []).map((user): TeamMember => ({
        id: user.id,
        user_id: user.user_id ?? '',
        email: user.email,
        first_name: user.first_name,
        last_name: null,
        full_name: user.name || user.first_name || null,
        role: user.role as TeamMember['role'],
        status: user.status as TeamMember['status'],
        avatar_url: user.avatar_url,
        created_at: user.created_at ?? '',
        last_login_at: user.last_login_at,
        is_owner: false,
      }));

      return [ownerData, ...members];
    },
    enabled: !!tenant?.id,
  });

  // Fetch pending invitations
  const {
    data: pendingInvitations = [],
    isLoading: loadingInvitations,
  } = useQuery({
    queryKey: queryKeys.team.invitations(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'list_invitations',
          tenantId: tenant.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return (data?.invitations ?? []) as Invitation[];
    },
    enabled: !!tenant?.id,
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data: response, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'send_invitation',
          tenantId: tenant.id,
          email: data.email,
          firstName: data.first_name,
          lastName: data.last_name,
          role: data.role,
        },
      });

      if (error) throw error;
      if (response?.error) throw new Error(response.error);

      return response;
    },
    onSuccess: () => {
      toast.success('Invitation sent successfully');
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setFormErrors({});
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenant?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.team.invitations(tenant?.id) });
    },
    onError: (error: Error) => {
      logger.error('Failed to send invitation', error, { component: 'TeamManagement' });
      toast.error(humanizeError(error, 'Failed to send invitation'));
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenant_users')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenant?.id) });
      // Invalidate user-role queries so sidebar reflects new permissions without reload
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all });
    },
    onError: (error: Error) => {
      logger.error('Failed to update role', error, { component: 'TeamManagement' });
      toast.error(humanizeError(error, 'Failed to update role'));
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: 'active' | 'suspended' }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenant_users')
        .update({ status: newStatus })
        .eq('user_id', userId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      toast.success(newStatus === 'suspended' ? 'Member suspended' : 'Member reactivated');
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenant?.id) });
      // Invalidate user-role queries so sidebar reflects updated access
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all });
    },
    onError: (error: Error) => {
      logger.error('Failed to update status', error, { component: 'TeamManagement' });
      toast.error(humanizeError(error, 'Failed to update status'));
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('tenant_users')
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Team member removed');
      setDeleteDialogOpen(false);
      setMemberToRemove(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenant?.id) });
      // Invalidate user-role queries so sidebar reflects removed access
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all });
    },
    onError: (error: Error) => {
      logger.error('Failed to remove member', error, { component: 'TeamManagement' });
      toast.error(humanizeError(error, 'Failed to remove team member'));
    },
  });

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof InviteFormData, string>> = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.role) {
      errors.role = 'Role is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    inviteMutation.mutate(formData);
  };

  const handleRemoveClick = (userId: string, name: string) => {
    setMemberToRemove({ userId, name });
    setDeleteDialogOpen(true);
  };

  const handleRemove = () => {
    if (memberToRemove) {
      removeMutation.mutate(memberToRemove.userId);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'admin':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'member':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'viewer':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <UserCheck className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <UserX className="h-3 w-3 mr-1" />
            Suspended
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30">
            {status}
          </Badge>
        );
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const columns = useMemo<ResponsiveColumn<TeamMember>[]>(
    () => [
      {
        header: 'Name',
        cell: (row) => (
          <div className="flex items-center gap-3">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center ${
                row.is_owner ? 'bg-purple-500/10' : 'bg-primary/10'
              }`}
            >
              <Users className={`h-4 w-4 ${row.is_owner ? 'text-purple-500' : 'text-primary'}`} />
            </div>
            <div>
              <div className="font-medium flex items-center gap-2">
                {row.full_name || row.email}
                {row.is_owner && (
                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                    Owner
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{row.email}</div>
            </div>
          </div>
        ),
      },
      {
        header: 'Role',
        cell: (row) => (
          <Badge className={getRoleBadgeColor(row.role)} variant="outline">
            <Shield className="h-3 w-3 mr-1" />
            {getRoleLabel(row.role)}
          </Badge>
        ),
      },
      {
        header: 'Status',
        cell: (row) => getStatusBadge(row.status),
      },
      {
        header: 'Joined',
        accessorKey: 'created_at',
        cell: (row) => (row.created_at ? formatSmartDate(row.created_at) : 'N/A'),
      },
      {
        header: 'Actions',
        cell: (row) => {
          if (row.is_owner) {
            return <span className="text-xs text-muted-foreground italic">Cannot modify owner</span>;
          }

          const isUpdating = updateRoleMutation.isPending || updateStatusMutation.isPending || removeMutation.isPending;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0" disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit('team') && (
                  <>
                    <DropdownMenuItem
                      onClick={() => updateRoleMutation.mutate({ userId: row.user_id, newRole: 'admin' })}
                      disabled={row.role === 'admin' || isUpdating}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateRoleMutation.mutate({ userId: row.user_id, newRole: 'member' })}
                      disabled={row.role === 'member' || isUpdating}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => updateRoleMutation.mutate({ userId: row.user_id, newRole: 'viewer' })}
                      disabled={row.role === 'viewer' || isUpdating}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Make Viewer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {row.status === 'active' ? (
                      <DropdownMenuItem
                        onClick={() => updateStatusMutation.mutate({ userId: row.user_id, newStatus: 'suspended' })}
                        className="text-amber-600"
                        disabled={isUpdating}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Suspend Member
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => updateStatusMutation.mutate({ userId: row.user_id, newStatus: 'active' })}
                        className="text-green-600"
                        disabled={isUpdating}
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Reactivate Member
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                {canDelete('team') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleRemoveClick(row.user_id, row.full_name || row.email)}
                      className="text-destructive"
                      disabled={isUpdating}
                    >
                      Remove Member
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-render columns when isPending changes; mutation objects are stable
    [updateRoleMutation.isPending, updateStatusMutation.isPending, removeMutation.isPending, canEdit, canDelete]
  );

  if (authLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (membersError && teamMembers.length === 0) {
    return (
      <div className="p-6">
        <Card className="border-destructive p-6">
          <p className="text-destructive">Failed to load team members. Please try again.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchMembers()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  // Calculate limits
  const activeUserCount = teamMembers.filter((m) => m.status === 'active').length;
  const userLimit =
    (tenant?.limits as Record<string, unknown>)?.users ||
    (tenant?.limits as Record<string, unknown>)?.team_members ||
    3;
  const isEnterprise = tenant?.subscription_plan === 'enterprise';
  const isLimitReached = !isEnterprise && activeUserCount >= (userLimit as number);

  return (
    <div className="space-y-4">
      <SEOHead title="Team Management" description="Manage your team members and permissions" />

      {membersError && teamMembers.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Failed to load team members. Showing cached data.</span>
          <Button variant="ghost" size="sm" onClick={() => refetchMembers()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            Manage your team members, roles, and permissions
            {!isEnterprise && (
              <span className="ml-2 text-sm">
                ({String(activeUserCount)}/{String(userLimit)} users)
              </span>
            )}
          </p>
          {isLimitReached && (
            <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              User limit reached. Upgrade your plan to invite more team members.
            </p>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {canEdit('team') && (
            <DialogTrigger asChild>
              <Button disabled={isLimitReached || inviteMutation.isPending}>
                <Plus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to add a new member to your team.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <Label htmlFor="email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="member@company.com"
                  className={formErrors.email ? 'border-destructive' : ''}
                />
                {formErrors.email && (
                  <p className="text-sm text-destructive mt-1">{formErrors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'admin' | 'member' | 'viewer') =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger className={formErrors.role ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex flex-col">
                        <span>Admin</span>
                        <span className="text-xs text-muted-foreground">
                          Full access to manage settings and team
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="member">
                      <div className="flex flex-col">
                        <span>Member</span>
                        <span className="text-xs text-muted-foreground">
                          Can manage orders, inventory, and customers
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="flex flex-col">
                        <span>Viewer</span>
                        <span className="text-xs text-muted-foreground">Read-only access to data</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.role && (
                  <p className="text-sm text-destructive mt-1">{formErrors.role}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setFormData(initialFormData);
                    setFormErrors({});
                  }}
                  disabled={inviteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Invitation'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invitations */}
      {!loadingInvitations && pendingInvitations.length > 0 && (
        <PendingInvitations
          invitations={pendingInvitations}
          tenantId={tenant?.id ?? ''}
          onInvitationsChange={() =>
            queryClient.invalidateQueries({ queryKey: queryKeys.team.invitations(tenant?.id) })
          }
        />
      )}

      {/* Team Members */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </h3>
        </div>
        {loadingMembers ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={teamMembers}
            keyExtractor={(item) => item.id}
            emptyState={{
              title: 'No team members',
              description: 'Invite your first team member to get started.',
              icon: Users,
            }}
            className="border-0 rounded-none"
          />
        )}
      </Card>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleRemove}
        itemName={memberToRemove?.name}
        itemType="team member"
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
