import { logger } from '@/lib/logger';
import { useState, useEffect, useMemo } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Users, Plus, Edit, Trash2, Mail, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SEOHead } from '@/components/SEOHead';
import { PendingInvitations } from '@/components/admin/PendingInvitations';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';

export default function TeamManagement() {
  const { tenant, loading: authLoading } = useTenantAdminAuth();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Invite Form
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'team_member'
  });

  useEffect(() => {
    if (tenant) {
      loadTeamMembers();
      loadPendingInvitations();
    }
  }, [tenant]);

  const loadTeamMembers = async () => {
    if (!tenant) return;

    try {
      const { data: tenantUsers, error: tenantUsersError } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantUsersError) throw tenantUsersError;

      // Get tenant owner info - use slug as identifier since owner_email may not exist
      const ownerData = {
        user_id: 'owner',
        email: tenant.slug,
        full_name: 'Business Owner',
        role: 'owner',
        status: 'active',
        is_owner: true
      };

      // Filter out owner from tenantUsers if they are already there to avoid duplicates, 
      // or just assume they are separate. Usually owner is a separate concept or has a role 'owner' in tenant_users.
      // Based on previous code, it appended owner manually. We will stick to that.
      setTeamMembers([ownerData, ...(tenantUsers || [])]);
    } catch (error) {
      logger.error('Error loading team members', error, { component: 'TeamManagement' });
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    try {
      const { data, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'send_invitation',
          tenantId: tenant.id,
          email: formData.email,
          role: formData.role,
        }
      });

      if (error) throw error;

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to send invitation');
      }

      toast({
        title: 'Invitation Sent',
        description: `Invitation sent to ${formData.email}.`
      });

      setIsDialogOpen(false);
      setFormData({ email: '', full_name: '', role: 'team_member' });
      loadTeamMembers();
      loadPendingInvitations();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invitation';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const loadPendingInvitations = async () => {
    if (!tenant) return;
    try {
      const { data, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'list_invitations',
          tenantId: tenant.id,
        }
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load invitations');
      }

      setPendingInvitations(data?.invitations || []);
    } catch (error) {
      logger.error('Error loading pending invitations', error, { component: 'TeamManagement' });
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!tenant) return;
    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Role updated successfully' });
      loadTeamMembers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update role';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleRemoveClick = (userId: string, name: string) => {
    setMemberToRemove({ userId, name });
    setDeleteDialogOpen(true);
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    try {
      setIsRemoving(true);
      const { error } = await supabase
        .from('tenant_users')
        .delete()
        .eq('user_id', memberToRemove.userId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Team member removed successfully' });
      loadTeamMembers();
      setDeleteDialogOpen(false);
      setMemberToRemove(null);
    } catch (error: unknown) {
      logger.error('Failed to remove team member', error, { component: 'TeamManagement' });
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove team member',
        variant: 'destructive'
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'admin': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'member': return 'bg-green-500/10 text-green-600 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // --- Columns ---
  const columns = useMemo<ResponsiveColumn<any>[]>(() => [
    {
      header: "Name",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-full flex items-center justify-center ${row.is_owner ? 'bg-purple-500/10' : 'bg-primary/10'}`}>
            <Users className={`h-4 w-4 ${row.is_owner ? 'text-purple-500' : 'text-primary'}`} />
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {row.full_name || 'No Name'}
              {row.is_owner && <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">Owner</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: "Role",
      cell: (row) => (
        <Badge className={getRoleBadgeColor(row.role)} variant="outline">
          <Shield className="h-3 w-3 mr-1" />
          {getRoleLabel(row.role)}
        </Badge>
      )
    },
    {
      header: "Joined",
      accessorKey: "created_at",
      cell: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'
    },
    {
      header: "Actions",
      cell: (row) => {
        if (row.role === 'owner' || row.user_id === 'owner' || row.is_owner) {
          return <span className="text-xs text-muted-foreground italic">Cannot modify owner</span>;
        }

        return (
          <div className="flex items-center gap-2">
            <Select
              value={row.role}
              onValueChange={(value) => handleUpdateRole(row.user_id, value)}
            >
              <SelectTrigger className="h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive/90"
              onClick={() => handleRemoveClick(row.user_id, row.full_name || row.email)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      }
    }
  ], []);


  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Calculate limits
  const activeUserCount = teamMembers.filter(m => m.status !== 'deleted' && m.status !== 'suspended').length;
  const userLimit = (tenant?.limits as any)?.users || (tenant?.limits as any)?.team_members || 3;
  const isEnterprise = tenant?.subscription_plan === 'enterprise';
  const isLimitReached = !isEnterprise && activeUserCount >= userLimit;

  return (
    <div className="space-y-6">
      <SEOHead
        title="Team Management"
        description="Manage your team members and permissions"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            Manage your team members and roles
            {!isEnterprise && (
              <span className="ml-2 text-sm">
                ({activeUserCount}/{userLimit} users)
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
          <DialogTrigger asChild>
            <Button disabled={isLimitReached}>
              <Plus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="member@company.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Send Invitation</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invitations */}
      <PendingInvitations
        invitations={pendingInvitations}
        tenantId={tenant?.id || ''}
        onInvitationsChange={loadPendingInvitations}
      />

      {/* Team Members */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Active Users
          </h3>
        </div>
        <ResponsiveTable
          columns={columns}
          data={teamMembers}
          keyExtractor={(item) => item.user_id}
          emptyState={{
            title: "No team members",
            description: "Invite your first team member to get started.",
            icon: Users
          }}
          className="border-0 rounded-none"
        />
      </Card>


      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleRemove}
        itemName={memberToRemove?.name}
        itemType="team member"
        isLoading={isRemoving}
      />
    </div>
  );
}
