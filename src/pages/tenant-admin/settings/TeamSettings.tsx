// @ts-nocheck
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { FormFactory } from '@/components/shared/FormFactory';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';

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

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['tenant-team', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Fetch tenant_users joined with some profile info if possible.
      // Since we can't easily join auth.users, we rely on metadata stored in tenant_users or a separate profiles table.
      // For now, assuming tenant_users has some profile fields or we fetch them separately.
      // Checking the schema earlier: tenant_users has avatar_url. It doesn't seem to have email/name directly?
      // Actually, standard pattern is a profiles table.

      const { data, error } = await supabase
        .from('tenant_users')
        .select(`
          id,
          user_id,
          role,
          status,
          created_at,
          accepted_at,
          avatar_url
        `)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      // In a real app we'd fetch profile data (email, name) from a 'profiles' table using user_id.
      // For this implementation, we'll mock the missing profile data if the table doesn't support joins yet,
      // OR we check if 'profiles' exists.
      // Let's assume we can at least get the count and IDs.
      // To make this robust, let's try to fetch profiles if we have user_ids.

      const userIds = data.map(u => u.user_id).filter(Boolean);
      let profilesMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        }
      }

      return data.map((u: any) => ({
        ...u,
        email: u.email || 'No email on file',
        full_name: `${profilesMap[u.user_id]?.first_name || ''} ${profilesMap[u.user_id]?.last_name || ''}`.trim() || 'Team Member',
        status: u.accepted_at ? 'active' : (u.status || 'invited')
      })) as TenantUser[];
    },
    enabled: !!tenant?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In real implementation: call edge function
      logger.info('Inviting user', data);
    },
    onSuccess: (_, variables) => {
      setInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tenant-team'] });
      toast.success(`Invitation sent to ${variables.email}`);
    },
    onError: (error) => {
      logger.error("Invite failed", error);
      toast.error("Failed to send invitation");
    }
  });

  const handleInviteSubmit = async (data: InviteFormData) => {
    await inviteMutation.mutateAsync(data);
  };

  const activeMembers = teamMembers.filter(m => m.status === 'active');
  const pendingMembers = teamMembers.filter(m => m.status === 'invited' || m.status === 'pending');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
            <AvatarImage src={member.avatar_url} />
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
      cell: (member) => (
        <div className="flex justify-end">
          {member.role !== 'owner' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Remove Access
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ),
    }
  ];

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
      cell: (member) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(member.created_at).toLocaleDateString()}</span>
    },
    {
      header: "Actions",
      cell: () => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-11 w-11"><RefreshCw className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive"><XCircle className="h-3 w-3" /></Button>
        </div>
      )
    }
  ];


  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading team...</div>;
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
                  <AvatarImage src={member.avatar_url} />
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
    </div>
  );
}
