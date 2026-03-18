import { useState } from 'react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import {
  SettingsSection,
  SettingsCard,
} from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  Users,
  UserPlus,
  Shield,
  MoreVertical,
  Clock,
  XCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { formatSmartDate } from '@/lib/formatters';
import { z } from 'zod';
import { FormFactory } from '@/components/shared/FormFactory';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { getInitials } from '@/lib/utils/getInitials';

// --- Types & Schemas ---

interface TenantUser {
  id: string; // This is the tenant_user ID (join table)
  user_id: string; // The auth user ID
  role: string;
  status: 'active' | 'invited' | 'disabled';
  email?: string; // Often joined from auth.users or profiles
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  accepted_at?: string;
}

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full access + billing' },
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'manager', label: 'Manager', description: 'Can manage operations and staff' },
  { value: 'staff', label: 'Staff', description: 'Standard access' },
  { value: 'driver', label: 'Driver', description: 'Delivery app access only' },
];

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
});

type InviteFormData = z.infer<typeof inviteSchema>;

// --- Components ---

export default function TeamSettings() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: queryKeys.team.members(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          id,
          user_id,
          role,
          status,
          created_at,
          accepted_at,
          avatar_url,
          email,
          first_name,
          name
        `)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      const userIds = data.map(u => u.user_id).filter(Boolean);
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc: Record<string, { first_name: string | null; last_name: string | null }>, p: typeof profiles[number]) => ({ ...acc, [p.id]: p }), {});
        }
      }

      return data.map((u) => ({
        id: u.id,
        user_id: u.user_id ?? '',
        role: u.role || 'staff',
        status: (u.accepted_at ? 'active' : (u.status || 'invited')) as TenantUser['status'],
        email: u.email || 'No email on file',
        full_name: `${profilesMap[u.user_id]?.first_name ?? u.first_name ?? ''} ${profilesMap[u.user_id]?.last_name ?? ''}`.trim() || u.name || 'Team Member',
        avatar_url: u.avatar_url || undefined,
        created_at: u.created_at ?? '',
        accepted_at: u.accepted_at || undefined,
      })) as TenantUser[];
    },
    enabled: !!tenant?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data: response, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'send_invitation',
          tenantId: tenant.id,
          email: data.email,
          role: data.role,
        },
      });

      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: (_, variables) => {
      setInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenant?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.team.invitations(tenant?.id) });
      toast.success(`Invitation sent to ${variables.email}`);
    },
    onError: (error: Error) => {
      logger.error('Invite failed', error, { component: 'TeamSettings' });
      toast.error(humanizeError(error, 'Failed to send invitation'));
    },
  });

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
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all });
    },
    onError: (error: Error) => {
      logger.error('Failed to update role', error, { component: 'TeamSettings' });
      toast.error(humanizeError(error, 'Failed to update role'));
    },
  });

  const removeMemberMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all });
    },
    onError: (error: Error) => {
      logger.error('Failed to remove member', error, { component: 'TeamSettings' });
      toast.error(humanizeError(error, 'Failed to remove team member'));
    },
  });

  const handleInviteSubmit = async (data: InviteFormData) => {
    await inviteMutation.mutateAsync(data);
  };

  const handleRemoveClick = (userId: string, name: string) => {
    setMemberToRemove({ userId, name });
    setDeleteDialogOpen(true);
  };

  const handleRemove = () => {
    if (memberToRemove) {
      removeMemberMutation.mutate(memberToRemove.userId);
    }
  };

  const activeMembers = teamMembers.filter(m => m.status === 'active');
  const pendingMembers = teamMembers.filter(m => m.status === 'invited' || (m.status as string) === 'pending');


  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'driver': return 'outline';
      default: return 'outline';
    }
  };

  const columns: ResponsiveColumn<TenantUser>[] = [
    {
      header: "Member",
      cell: (member) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border">
            <AvatarImage src={member.avatar_url} alt={member.full_name || member.email || "Team member"} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
              {getInitials(member.full_name || member.email || '?')}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm">{member.full_name}</div>
            <div className="text-xs text-muted-foreground">{member.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Role",
      cell: (member) => (
        <Badge variant={getRoleBadgeVariant(member.role)} className="capitalize text-[10px] px-1.5 py-0.5 h-auto">
          {member.role === 'owner' && <Shield className="h-3 w-3 mr-1" />}
          {member.role}
        </Badge>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (member) => {
        if (member.role === 'owner') {
          return <span className="text-xs text-muted-foreground italic">Cannot modify owner</span>;
        }

        const isUpdating = updateRoleMutation.isPending || removeMemberMutation.isPending;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11" disabled={isUpdating} aria-label="Team member actions">
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {ROLES.filter(r => r.value !== 'owner').map((role) => (
                  <DropdownMenuItem
                    key={role.value}
                    onClick={() => updateRoleMutation.mutate({ userId: member.user_id, newRole: role.value })}
                    disabled={member.role === role.value || isUpdating}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Make {role.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleRemoveClick(member.user_id, member.full_name || member.email || 'this member')}
                  className="text-destructive"
                  disabled={isUpdating}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Remove Access
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    }
  ];

  const resendInviteMutation = useMutation({
    mutationFn: async (member: TenantUser) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { data: response, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'send_invitation',
          tenantId: tenant.id,
          email: member.email,
          role: member.role,
        },
      });
      if (error) throw error;
      if (response?.error) throw new Error(response.error);
      return response;
    },
    onSuccess: (_, variables) => {
      toast.success(`Invitation resent to ${variables.email}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenant?.id) });
    },
    onError: (error: Error) => {
      logger.error('Failed to resend invitation', error, { component: 'TeamSettings' });
      toast.error(humanizeError(error, 'Failed to resend invitation'));
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('tenant_users')
        .delete()
        .eq('id', memberId)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Invitation cancelled');
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(tenant?.id) });
    },
    onError: (error: Error) => {
      logger.error('Failed to cancel invitation', error, { component: 'TeamSettings' });
      toast.error(humanizeError(error, 'Failed to cancel invitation'));
    },
  });

  const pendingColumns: ResponsiveColumn<TenantUser>[] = [
    {
      header: "Email",
      accessorKey: "email",
      className: "w-full",
    },
    {
      header: "Role",
      cell: (member) => <Badge variant="outline">{member.role}</Badge>
    },
    {
      header: "Invited",
      cell: (member) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatSmartDate(member.created_at)}</span>
    },
    {
      header: "Actions",
      cell: (member) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => resendInviteMutation.mutate(member)}
            disabled={resendInviteMutation.isPending}
            aria-label="Resend invite"
          >
            {resendInviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-destructive"
            onClick={() => cancelInviteMutation.mutate(member.id)}
            disabled={cancelInviteMutation.isPending}
            aria-label="Cancel invite"
          >
            {cancelInviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
          </Button>
        </div>
      )
    }
  ];


  if (isLoading) {
    return <EnhancedLoadingState variant="table" message="Loading team..." />;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team Management</h2>
          <p className="text-muted-foreground mt-1">
            Manage your team members, roles, and permissions
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-sm">
              <UserPlus className="h-5 w-5 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your team. They'll receive an email with a link to accept.
              </DialogDescription>
            </DialogHeader>
            <FormFactory
              schema={inviteSchema}
              defaultValues={{ email: '', role: 'staff' }}
              onSubmit={handleInviteSubmit}
              fields={[
                {
                  name: 'email',
                  label: 'Email Address',
                  type: 'email',
                  placeholder: 'colleague@company.com'
                },
                {
                  name: 'role',
                  label: 'Role',
                  type: 'custom',
                  render: (form) => (
                    <div className="space-y-2">
                      {/* We can use standard select here inside custom render to map to form control if needed, 
                             or rely on Select component manually controlled.
                             FormFactory is best for simple inputs, for Select we might need a Select wrapper or use 'custom'.
                         */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            {form.watch('role') ? ROLES.find(r => r.value === form.watch('role'))?.label : "Select role"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-full min-w-[300px]">
                          {ROLES.map(role => (
                            <DropdownMenuItem
                              key={role.value}
                              onClick={() => form.setValue('role', role.value)}
                              className="flex flex-col items-start p-2"
                            >
                              <span className="font-medium">{role.label}</span>
                              <span className="text-xs text-muted-foreground">{role.description}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )
                }
              ]}
              submitText="Send Invite"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SettingsCard className="text-center p-6 bg-card border shadow-sm">
          <p className="text-3xl font-bold text-primary">{activeMembers.length}</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">Active Members</p>
        </SettingsCard>
        <SettingsCard className="text-center p-6 bg-card border shadow-sm">
          <p className="text-3xl font-bold text-amber-500">{pendingMembers.length}</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">Pending Invites</p>
        </SettingsCard>
        <SettingsCard className="text-center p-6 bg-card border shadow-sm">
          <p className="text-3xl font-bold text-slate-400">Unlimited</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">Plan Limit</p>
        </SettingsCard>
      </div>

      {/* Active Members */}
      <SettingsSection
        title="Team Members"
        description={`${activeMembers.length} active members with access to the platform`}
        icon={Users}
      >
        <SettingsCard className="p-0 overflow-hidden border-0 shadow-none">
          <ResponsiveTable
            data={activeMembers}
            columns={columns}
            keyExtractor={(item) => item.id}
            emptyState={{
              icon: Users,
              title: "No team members",
              description: "Invite your first team member to get started."
            }}
            mobileRenderer={(member) => (
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={member.avatar_url} alt={member.full_name || member.email || "Team member"} />
                  <AvatarFallback>{getInitials(member.full_name || '?')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium">{member.full_name}</div>
                  <div className="text-xs text-muted-foreground">{member.email}</div>
                  <Badge variant="outline" className="mt-1 text-[10px]">{member.role}</Badge>
                </div>
              </div>
            )}
          />
        </SettingsCard>
      </SettingsSection>

      {/* Pending Invitations */}
      {pendingMembers.length > 0 && (
        <SettingsSection
          title="Pending Invitations"
          description="Invitations waiting to be accepted"
          icon={Clock}
        >
          <SettingsCard className="p-0 overflow-hidden border-0 shadow-none">
            <ResponsiveTable
              data={pendingMembers}
              columns={pendingColumns}
              keyExtractor={(item) => item.id}
              mobileRenderer={(member) => (
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{member.email}</div>
                    <Badge variant="outline" className="text-[10px] mt-1 bg-amber-50 text-amber-600 border-amber-200">{member.role}</Badge>
                  </div>
                  <Button variant="ghost" size="sm">Resend</Button>
                </div>
              )}
            />
          </SettingsCard>
        </SettingsSection>
      )}

      {/* Roles & Permissions Info */}
      <SettingsCard className="bg-muted/50">
        <h4 className="font-medium mb-4">Role Permissions</h4>
        <div className="grid md:grid-cols-3 gap-4">
          {ROLES.map((role) => (
            <div key={role.value} className="space-y-2">
              <Badge variant={getRoleBadgeVariant(role.value)}>{role.label}</Badge>
              <p className="text-sm text-muted-foreground">{role.description}</p>
            </div>
          ))}
        </div>
      </SettingsCard>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleRemove}
        itemName={memberToRemove?.name}
        itemType="team member"
        isLoading={removeMemberMutation.isPending}
      />
    </div>
  );
}
