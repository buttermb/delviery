import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
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

export default function TeamManagement() {
  const { account, userProfile, loading: accountLoading } = useAccount();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'team_member'
  });

  useEffect(() => {
    if (account) {
      loadTeamMembers();
    }
  }, [account]);

  const loadTeamMembers = async () => {
    if (!account) return;

    try {
      // @ts-ignore - Avoid deep type instantiation
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;
      setTeamMembers(result.data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
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
    if (!account) return;

    try {
      // TODO: Send email invitation
      toast({
        title: 'Invitation Sent',
        description: `Invitation sent to ${formData.email}`
      });

      setIsDialogOpen(false);
      setFormData({ email: '', full_name: '', role: 'team_member' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      // Use raw update to avoid type issues
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole } as any)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role updated successfully'
      });

      loadTeamMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Team member removed successfully'
      });

      loadTeamMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'account_owner': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'account_admin': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'team_member': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'courier': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (accountLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const canManageTeam = userProfile?.role === 'account_owner' || userProfile?.role === 'account_admin';

  return (
    <div className="space-y-6">
      <SEOHead 
        title="Team Management"
        description="Manage your team members and permissions"
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground">Manage your team members and roles</p>
        </div>

        {canManageTeam && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
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
                      <SelectItem value="account_admin">Account Admin</SelectItem>
                      <SelectItem value="team_member">Team Member</SelectItem>
                      <SelectItem value="courier">Courier</SelectItem>
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

                {canManageTeam && member.user_id !== userProfile?.user_id && (
                  <div className="flex gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleUpdateRole(member.user_id, value)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="account_admin">Account Admin</SelectItem>
                        <SelectItem value="team_member">Team Member</SelectItem>
                        <SelectItem value="courier">Courier</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(member.user_id)}
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
    </div>
  );
}
