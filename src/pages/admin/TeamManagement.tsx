import { useState, useEffect } from 'react';
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
import { Users, Plus, Edit, Trash2, Mail, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SEOHead } from '@/components/SEOHead';
import { PendingInvitations } from '@/components/admin/PendingInvitations';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { logger } from '@/lib/logger';

export default function TeamManagement() {
  const { tenant, loading: authLoading } = useTenantAdminAuth();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
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

      // Also get the tenant owner
      const ownerData = {
        user_id: 'owner',
        email: tenant.slug, // You might want to get actual owner email
        full_name: 'Owner',
        role: 'owner'
      };

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

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to send invitation';
        throw new Error(errorMessage);
      }

      toast({
        title: 'Invitation Sent',
        description: `Invitation sent to ${formData.email}. They can accept it to join your team.`
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

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to load invitations';
        throw new Error(errorMessage);
      }

      setPendingInvitations(data?.invitations || []);
    } catch (error) {
      console.error('Error loading pending invitations:', error);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('tenant_users')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role updated successfully'
      });

      loadTeamMembers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove team member';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
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
        .eq('user_id', memberToRemove.userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Team member removed successfully'
      });

      loadTeamMembers();
      setDeleteDialogOpen(false);
      setMemberToRemove(null);
    } catch (error: unknown) {
      logger.error('Failed to remove team member', error, { component: 'TeamManagement', userId: memberToRemove.userId });
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

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const canManageTeam = true; // Tenant admins can always manage team

  // Calculate user limit and usage
  const activeUserCount = teamMembers.filter(m => m.status !== 'deleted' && m.status !== 'suspended').length;
  const userLimit = tenant?.limits?.users || tenant?.limits?.team_members || 3;
  const isEnterprise = tenant?.subscription_plan === 'enterprise';
  const isLimitReached = !isEnterprise && activeUserCount >= userLimit;
  const remainingUsers = isEnterprise ? Infinity : Math.max(0, userLimit - activeUserCount);

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
            <p className="text-sm text-amber-600 mt-1">
              User limit reached. Upgrade your plan to invite more team members.
            </p>
          )}
        </div>

        {canManageTeam && (
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
        )}
      </div>

      {/* Pending Invitations */}
      <PendingInvitations 
        invitations={pendingInvitations}
        tenantId={tenant.id}
        onInvitationsChange={loadPendingInvitations}
      />

      {/* Team Members */}
      <div className="grid gap-4">
        {teamMembers.map((member) => (
          <Card key={member.user_id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{member.full_name || 'No name'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {member.email || member.user_id}
                      </span>
                    </div>
                    <Badge className={`mt-2 ${getRoleBadgeColor(member.role)}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      {getRoleLabel(member.role)}
                    </Badge>
                  </div>
                </div>

                {canManageTeam && member.user_id !== 'owner' && (
                  <div className="flex gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleUpdateRole(member.user_id, value)}
                    >
                      <SelectTrigger className="w-[180px]">
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
                      onClick={() => handleRemoveClick(member.user_id, member.full_name || member.email || 'team member')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teamMembers.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No team members yet</h3>
            <p className="text-muted-foreground mb-4">Invite your first team member to get started</p>
            {canManageTeam && (
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            )}
          </CardContent>
        </Card>
      )}

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
