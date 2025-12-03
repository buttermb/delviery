import { useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Mail,
  Shield,
  MoreVertical,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'pending' | 'inactive';
  avatarUrl?: string;
  lastActive?: string;
}

const MOCK_TEAM: TeamMember[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'owner',
    status: 'active',
    lastActive: 'Now',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'admin',
    status: 'active',
    lastActive: '2 hours ago',
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'member',
    status: 'active',
    lastActive: 'Yesterday',
  },
  {
    id: '4',
    name: '',
    email: 'pending@example.com',
    role: 'member',
    status: 'pending',
  },
];

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'member', label: 'Member', description: 'Can manage orders and inventory' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

export default function TeamSettings() {
  const { admin } = useTenantAdminAuth();
  const [team, setTeam] = useState<TeamMember[]>(MOCK_TEAM);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const handleInvite = () => {
    if (!inviteEmail) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }

    setTeam([
      ...team,
      {
        id: Date.now().toString(),
        name: '',
        email: inviteEmail,
        role: inviteRole as TeamMember['role'],
        status: 'pending',
      },
    ]);

    toast({
      title: 'Invitation sent',
      description: `An invitation has been sent to ${inviteEmail}`,
    });

    setInviteEmail('');
    setInviteDialogOpen(false);
  };

  const handleResendInvite = (email: string) => {
    toast({ title: 'Invitation resent', description: `A new invitation has been sent to ${email}` });
  };

  const handleRemoveMember = (id: string) => {
    setTeam(team.filter((m) => m.id !== id));
    toast({ title: 'Member removed' });
  };

  const handleRoleChange = (id: string, role: string) => {
    setTeam(team.map((m) => (m.id === id ? { ...m, role: role as TeamMember['role'] } : m)));
    toast({ title: 'Role updated' });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const activeMembers = team.filter((m) => m.status === 'active');
  const pendingMembers = team.filter((m) => m.status === 'pending');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team</h2>
          <p className="text-muted-foreground mt-1">
            Manage team members and their access permissions
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
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
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <p className="font-medium">{role.label}</p>
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite}>
                <Mail className="h-4 w-4 mr-2" />
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-3 gap-4">
        <SettingsCard className="text-center">
          <p className="text-3xl font-bold">{activeMembers.length}</p>
          <p className="text-sm text-muted-foreground">Active Members</p>
        </SettingsCard>
        <SettingsCard className="text-center">
          <p className="text-3xl font-bold">{pendingMembers.length}</p>
          <p className="text-sm text-muted-foreground">Pending Invites</p>
        </SettingsCard>
        <SettingsCard className="text-center">
          <p className="text-3xl font-bold">5</p>
          <p className="text-sm text-muted-foreground">Max Members</p>
        </SettingsCard>
      </div>

      {/* Active Members */}
      <SettingsSection
        title="Team Members"
        description={`${activeMembers.length} active members`}
        icon={Users}
      >
        <SettingsCard>
          <div className="divide-y">
            {activeMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(member.name, member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.name || member.email}</span>
                      {member.role === 'owner' && (
                        <Badge variant="default" className="text-[10px]">
                          <Shield className="h-3 w-3 mr-1" />
                          Owner
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{member.email}</span>
                      {member.lastActive && (
                        <>
                          <span>•</span>
                          <Clock className="h-3 w-3" />
                          <span>{member.lastActive}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.role !== 'owner' && (
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {member.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRemoveMember(member.id)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Pending Invitations */}
      {pendingMembers.length > 0 && (
        <SettingsSection
          title="Pending Invitations"
          description="Invitations waiting to be accepted"
          icon={Clock}
        >
          <SettingsCard>
            <div className="divide-y">
              {pendingMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-amber-500/10 text-amber-600">
                        <Mail className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className="font-medium">{member.email}</span>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary">{member.role}</Badge>
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Pending
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvite(member.email)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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

