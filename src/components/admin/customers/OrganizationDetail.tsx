/**
 * OrganizationDetail Component
 *
 * Displays detailed information about an organization including
 * members, stats, orders, and management actions.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Building2,
  ArrowLeft,
  Users,
  DollarSign,
  Package,
  Calendar,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  Pencil,
  UserPlus,
  UserMinus,
  MoreHorizontal,
  Shield,
  ShoppingCart,
  Receipt,
  Crown,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { useOrganizationDetail } from '@/hooks/useOrganizations';
import { SmartClientPicker } from '@/components/wholesale/SmartClientPicker';
import {
  ORGANIZATION_TYPE_LABELS,
  ORGANIZATION_STATUS_LABELS,
  ORGANIZATION_MEMBER_ROLE_LABELS,
  type OrganizationWithStats,
  type OrganizationMember,
  type OrganizationMemberRole,
  type OrganizationStatus,
} from '@/types/organization';

interface OrganizationDetailProps {
  organization: OrganizationWithStats;
  onBack: () => void;
  onEdit: () => void;
  className?: string;
}

const STATUS_COLORS: Record<OrganizationStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
};

const ROLE_ICONS: Record<OrganizationMemberRole, typeof Users> = {
  owner: Crown,
  admin: Shield,
  buyer: ShoppingCart,
  viewer: Users,
};

export function OrganizationDetail({
  organization,
  onBack,
  onEdit,
  className,
}: OrganizationDetailProps) {
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<OrganizationMember | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<OrganizationMemberRole>('buyer');
  const [memberPermissions, setMemberPermissions] = useState({
    is_primary_contact: false,
    can_place_orders: true,
    can_view_invoices: true,
    can_manage_members: false,
  });

  const {
    members,
    isLoading,
    isLoadingMembers,
    addMember,
    removeMember,
    updateMember,
    isAddingMember,
    isRemovingMember,
    isUpdatingMember,
  } = useOrganizationDetail({
    organizationId: organization.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleAddMember = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer');
      return;
    }

    const result = await addMember({
      customer_id: selectedCustomerId,
      role: selectedRole,
      ...memberPermissions,
    });

    if (result) {
      toast.success('Member added to organization');
      setShowAddMemberDialog(false);
      resetAddMemberForm();
    } else {
      toast.error('Failed to add member');
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberTarget) return;

    const success = await removeMember(removeMemberTarget.id);
    if (success) {
      toast.success('Member removed from organization');
      setRemoveMemberTarget(null);
    } else {
      toast.error('Failed to remove member');
    }
  };

  const handleTogglePrimaryContact = async (member: OrganizationMember) => {
    const result = await updateMember(member.id, {
      is_primary_contact: !member.is_primary_contact,
    });
    if (result) {
      toast.success(
        member.is_primary_contact
          ? 'Removed as primary contact'
          : 'Set as primary contact'
      );
    } else {
      toast.error('Failed to update member');
    }
  };

  const resetAddMemberForm = () => {
    setSelectedCustomerId('');
    setSelectedRole('buyer');
    setMemberPermissions({
      is_primary_contact: false,
      can_place_orders: true,
      can_view_invoices: true,
      can_manage_members: false,
    });
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{organization.name}</h1>
                <Badge className={STATUS_COLORS[organization.status]}>
                  {ORGANIZATION_STATUS_LABELS[organization.status]}
                </Badge>
              </div>
              {organization.legal_name && organization.legal_name !== organization.name && (
                <p className="text-muted-foreground">{organization.legal_name}</p>
              )}
              <Badge variant="outline" className="mt-1">
                {ORGANIZATION_TYPE_LABELS[organization.organization_type]}
              </Badge>
            </div>
          </div>
        </div>
        <Button onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit Organization
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Members</p>
                <p className="text-3xl font-bold">{organization.member_count}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total LTV</p>
                <p className="text-3xl font-bold font-mono">{formatCurrency(organization.total_ltv)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                <p className="text-3xl font-bold">{organization.total_orders}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Order</p>
                <p className="text-3xl font-bold font-mono">{formatCurrency(organization.avg_order_value)}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members Section */}
        <Card className="lg:col-span-2 bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Members
              </CardTitle>
              <Button size="sm" onClick={() => setShowAddMemberDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMembers ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : members.length === 0 ? (
              <EnhancedEmptyState
                icon={Users}
                title="No Members"
                description="Add customers to this organization to enable group ordering and billing."
                primaryAction={{
                  label: 'Add Member',
                  onClick: () => setShowAddMemberDialog(true),
                }}
                compact
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const RoleIcon = ROLE_ICONS[member.role];
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-full">
                              <Users className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {member.customer?.first_name} {member.customer?.last_name}
                                {member.is_primary_contact && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Primary
                                  </Badge>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {member.customer?.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <RoleIcon className="h-3 w-3" />
                            {ORGANIZATION_MEMBER_ROLE_LABELS[member.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {member.can_place_orders && (
                              <Badge variant="secondary" className="text-xs">Orders</Badge>
                            )}
                            {member.can_view_invoices && (
                              <Badge variant="secondary" className="text-xs">Invoices</Badge>
                            )}
                            {member.can_manage_members && (
                              <Badge variant="secondary" className="text-xs">Members</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(member.joined_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isUpdatingMember}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleTogglePrimaryContact(member)}
                              >
                                {member.is_primary_contact
                                  ? 'Remove as Primary Contact'
                                  : 'Set as Primary Contact'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setRemoveMemberTarget(member)}
                                className="text-red-600"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remove from Organization
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Organization Details */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {organization.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${organization.email}`} className="text-primary hover:underline">
                    {organization.email}
                  </a>
                </div>
              )}
              {organization.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{organization.phone}</span>
                </div>
              )}
              {organization.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {organization.website}
                  </a>
                </div>
              )}
              {organization.address_line1 && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p>{organization.address_line1}</p>
                    {organization.address_line2 && <p>{organization.address_line2}</p>}
                    <p>
                      {[organization.city, organization.state, organization.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}
              {!organization.email && !organization.phone && !organization.website && !organization.address_line1 && (
                <p className="text-sm text-muted-foreground">No contact information provided</p>
              )}
            </CardContent>
          </Card>

          {/* License & Pricing */}
          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
            <CardHeader>
              <CardTitle className="text-base">License & Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {organization.license_number && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{organization.license_number}</p>
                    {organization.license_type && (
                      <p className="text-muted-foreground">{organization.license_type}</p>
                    )}
                    {organization.license_expiration && (
                      <p className="text-xs text-muted-foreground">
                        Expires: {format(new Date(organization.license_expiration), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {organization.discount_percentage != null && organization.discount_percentage > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>{organization.discount_percentage}% organization discount</span>
                </div>
              )}
              {organization.payment_terms && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Net {organization.payment_terms} payment terms</span>
                </div>
              )}
              {!organization.license_number &&
                !organization.discount_percentage &&
                !organization.payment_terms && (
                  <p className="text-sm text-muted-foreground">No license or pricing info</p>
                )}
            </CardContent>
          </Card>

          {/* Notes */}
          {organization.notes && (
            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{organization.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Timestamps */}
          <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]">
            <CardContent className="pt-6 space-y-2 text-sm text-muted-foreground">
              <p>Created: {format(new Date(organization.created_at), 'MMM d, yyyy h:mm a')}</p>
              <p>Updated: {format(new Date(organization.updated_at), 'MMM d, yyyy h:mm a')}</p>
              {organization.last_order_date && (
                <p>Last Order: {format(new Date(organization.last_order_date), 'MMM d, yyyy')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Member to {organization.name}
            </DialogTitle>
            <DialogDescription>
              Select a customer to add to this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <SmartClientPicker
                selectedClient={null}
                onSelect={(client) => setSelectedCustomerId(client.id)}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as OrganizationMemberRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORGANIZATION_MEMBER_ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Permissions</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="primary-contact" className="font-normal">
                    Primary Contact
                  </Label>
                  <Switch
                    id="primary-contact"
                    checked={memberPermissions.is_primary_contact}
                    onCheckedChange={(checked) =>
                      setMemberPermissions((p) => ({ ...p, is_primary_contact: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="can-orders" className="font-normal">
                    Can Place Orders
                  </Label>
                  <Switch
                    id="can-orders"
                    checked={memberPermissions.can_place_orders}
                    onCheckedChange={(checked) =>
                      setMemberPermissions((p) => ({ ...p, can_place_orders: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="can-invoices" className="font-normal">
                    Can View Invoices
                  </Label>
                  <Switch
                    id="can-invoices"
                    checked={memberPermissions.can_view_invoices}
                    onCheckedChange={(checked) =>
                      setMemberPermissions((p) => ({ ...p, can_view_invoices: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="can-members" className="font-normal">
                    Can Manage Members
                  </Label>
                  <Switch
                    id="can-members"
                    checked={memberPermissions.can_manage_members}
                    onCheckedChange={(checked) =>
                      setMemberPermissions((p) => ({ ...p, can_manage_members: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddMemberDialog(false);
                resetAddMemberForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={!selectedCustomerId || isAddingMember}>
              {isAddingMember ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removeMemberTarget} onOpenChange={() => setRemoveMemberTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>
                {removeMemberTarget?.customer?.first_name} {removeMemberTarget?.customer?.last_name}
              </strong>{' '}
              from this organization? They will no longer be able to place orders under this
              organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemovingMember}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRemovingMember ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
