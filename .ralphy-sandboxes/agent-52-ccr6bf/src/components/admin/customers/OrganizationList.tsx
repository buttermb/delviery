/**
 * OrganizationList Component
 *
 * Displays list of customer organizations with search, filtering,
 * and quick actions. Used in the Organizations management page.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Building2,
  Search,
  Plus,
  MoreHorizontal,
  Users,
  DollarSign,
  Package,
  Calendar,
  Eye,
  Pencil,
  Trash2,
  Filter,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { useOrganizations } from '@/hooks/useOrganizations';
import {
  ORGANIZATION_TYPE_LABELS,
  ORGANIZATION_STATUS_LABELS,
  type OrganizationWithStats,
  type OrganizationStatus,
  type OrganizationType,
} from '@/types/organization';

interface OrganizationListProps {
  onCreateClick: () => void;
  onViewClick: (org: OrganizationWithStats) => void;
  onEditClick: (org: OrganizationWithStats) => void;
  className?: string;
}

const STATUS_COLORS: Record<OrganizationStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
};

export function OrganizationList({
  onCreateClick,
  onViewClick,
  onEditClick,
  className,
}: OrganizationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrganizationStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<OrganizationType | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<OrganizationWithStats | null>(null);

  const {
    organizations,
    isLoading,
    error,
    deleteOrganization,
    updateStatus,
    isDeleting,
  } = useOrganizations({
    filters: {
      search: searchQuery || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      organization_type: typeFilter === 'all' ? undefined : typeFilter,
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;

    const success = await deleteOrganization(deleteTarget.id);
    if (success) {
      toast.success(`${deleteTarget.name} has been deleted`);
      setDeleteTarget(null);
    } else {
      toast.error('Failed to delete organization');
    }
  };

  const handleStatusChange = async (org: OrganizationWithStats, newStatus: OrganizationStatus) => {
    const success = await updateStatus(org.id, newStatus);
    if (success) {
      toast.success(`${org.name} status updated to ${ORGANIZATION_STATUS_LABELS[newStatus]}`);
    } else {
      toast.error('Failed to update status');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <EnhancedEmptyState
            icon={Building2}
            title="Unable to Load Organizations"
            description="There was an error loading the organizations list. Please try again."
            primaryAction={{
              label: 'Retry',
              onClick: () => window.location.reload(),
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))]', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
            {organizations.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {organizations.length}
              </Badge>
            )}
          </CardTitle>
          <Button onClick={onCreateClick}>
            <Plus className="h-4 w-4 mr-2" />
            New Organization
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as OrganizationStatus | 'all')}
          >
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(ORGANIZATION_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as OrganizationType | 'all')}
          >
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(ORGANIZATION_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Organizations Table */}
        {organizations.length === 0 ? (
          <EnhancedEmptyState
            icon={Building2}
            title="No Organizations Found"
            description={
              searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No organizations match your filters. Try adjusting your search.'
                : 'Create your first organization to group customers for B2B wholesale relationships.'
            }
            primaryAction={{
              label: 'Create Organization',
              onClick: onCreateClick,
            }}
          />
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">Members</TableHead>
                  <TableHead className="text-right">Total LTV</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow
                    key={org.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewClick(org)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          {org.legal_name && org.legal_name !== org.name && (
                            <p className="text-xs text-muted-foreground">{org.legal_name}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ORGANIZATION_TYPE_LABELS[org.organization_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{org.member_count}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{formatCurrency(org.total_ltv)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{org.total_orders}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.last_order_date ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(org.last_order_date), 'MMM d, yyyy')}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No orders</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[org.status]}>
                        {ORGANIZATION_STATUS_LABELS[org.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onViewClick(org);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            onEditClick(org);
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {org.status !== 'active' && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(org, 'active');
                            }}>
                              Activate
                            </DropdownMenuItem>
                          )}
                          {org.status !== 'inactive' && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(org, 'inactive');
                            }}>
                              Deactivate
                            </DropdownMenuItem>
                          )}
                          {org.status !== 'suspended' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(org, 'suspended');
                              }}
                              className="text-amber-600"
                            >
                              Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(org);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will
              remove all member associations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
