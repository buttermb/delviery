/**
 * Tenant Credits Management Page - Super Admin
 * 
 * Lists all tenants with credit information, filtering,
 * and management actions.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  MoreHorizontal,
  Crown,
  AlertTriangle,
  XCircle,
  CheckCircle,
  RefreshCw,
  Gift,
  Eye,
  Edit,
  UserCog,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  getTenantsWithCredits,
  getTenantCreditDetail,
  grantBulkCredits,
} from '@/lib/credits';
import { TenantCreditDetailPanel } from '@/components/super-admin/TenantCreditDetailPanel';
import { CreditAdjustmentForm } from '@/components/super-admin/CreditAdjustmentForm';
import { queryKeys } from '@/lib/queryKeys';

type CreditStatus = 'all' | 'healthy' | 'warning' | 'critical' | 'depleted' | 'unlimited';

export default function TenantCreditsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // State
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<CreditStatus>(
    (searchParams.get('status') as CreditStatus) || 'all'
  );
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [detailTenantId, setDetailTenantId] = useState<string | null>(
    searchParams.get('tenant') || null
  );
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustTenantId, setAdjustTenantId] = useState<string | null>(null);
  const [showBulkGrant, setShowBulkGrant] = useState(false);
  const [bulkGrantAmount, setBulkGrantAmount] = useState(100);

  // Fetch tenants
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.superAdminTools.tenantCredits(statusFilter, search),
    queryFn: () => getTenantsWithCredits({
      status: statusFilter === 'all' ? null : statusFilter,
      search: search || undefined,
      limit: 100,
    }),
  });

  // Fetch detail for selected tenant
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.tenantCreditDetail(detailTenantId),
    queryFn: () => detailTenantId ? getTenantCreditDetail(detailTenantId) : null,
    enabled: !!detailTenantId,
  });

  // Bulk grant mutation
  const bulkGrantMutation = useMutation({
    mutationFn: (data: { tenantIds: string[]; amount: number }) => 
      grantBulkCredits({
        tenantIds: data.tenantIds,
        amount: data.amount,
        grantType: 'admin_grant',
        notes: 'Bulk grant from admin panel',
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Granted credits to ${result.count} tenants`);
        setSelectedTenants([]);
        setShowBulkGrant(false);
        queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.tenantCredits() });
      } else {
        toast.error(result.error || 'Failed to grant credits');
      }
    },
  });

  // Status badge helper
  const getStatusBadge = (status: string, isFreeTier: boolean) => {
    if (!isFreeTier) {
      return <Badge className="bg-purple-100 text-purple-800"><Crown className="h-3 w-3 mr-1" />Unlimited</Badge>;
    }
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" />Warning</Badge>;
      case 'critical':
        return <Badge className="bg-orange-100 text-orange-800"><AlertTriangle className="h-3 w-3 mr-1" />Critical</Badge>;
      case 'depleted':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Depleted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTenants(data?.tenants.map(t => t.tenantId) || []);
    } else {
      setSelectedTenants([]);
    }
  };

  // Handle row select
  const handleRowSelect = (tenantId: string, checked: boolean) => {
    if (checked) {
      setSelectedTenants([...selectedTenants, tenantId]);
    } else {
      setSelectedTenants(selectedTenants.filter(id => id !== tenantId));
    }
  };

  // Open detail panel
  const openDetail = (tenantId: string) => {
    setDetailTenantId(tenantId);
    setSearchParams({ ...Object.fromEntries(searchParams), tenant: tenantId });
  };

  // Close detail panel
  const closeDetail = () => {
    setDetailTenantId(null);
    searchParams.delete('tenant');
    setSearchParams(searchParams);
  };

  // Open adjustment form
  const openAdjustment = (tenantId: string) => {
    setAdjustTenantId(tenantId);
    setShowAdjustForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Credit Management</h1>
          <p className="text-muted-foreground">
            View and manage credit balances for all tenants
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {selectedTenants.length > 0 && (
            <Button onClick={() => setShowBulkGrant(true)}>
              <Gift className="h-4 w-4 mr-2" />
              Grant Credits ({selectedTenants.length})
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as CreditStatus)}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="depleted">Depleted</SelectItem>
                <SelectItem value="unlimited">Unlimited (Paid)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{data?.total || 0}</div>
          <div className="text-sm text-muted-foreground">Total Tenants</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {data?.tenants.filter(t => t.creditStatus === 'healthy').length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Healthy</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {data?.tenants.filter(t => t.creditStatus === 'warning').length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Warning</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-orange-600">
            {data?.tenants.filter(t => t.creditStatus === 'critical').length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Critical</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">
            {data?.tenants.filter(t => t.creditStatus === 'depleted').length || 0}
          </div>
          <div className="text-sm text-muted-foreground">Depleted</div>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedTenants.length === data?.tenants.length && data?.tenants.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Used Today</TableHead>
                <TableHead className="text-right">Used This Month</TableHead>
                <TableHead className="text-right">Lifetime Spent</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : data?.tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No tenants found
                  </TableCell>
                </TableRow>
              ) : (
                data?.tenants.map((tenant) => (
                  <TableRow 
                    key={tenant.tenantId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(tenant.tenantId)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedTenants.includes(tenant.tenantId)}
                        onCheckedChange={(checked) => handleRowSelect(tenant.tenantId, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tenant.tenantName}</p>
                        <p className="text-sm text-muted-foreground">@{tenant.tenantSlug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(tenant.creditStatus, tenant.isFreeTier)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {tenant.isFreeTier ? (
                        <span className={
                          tenant.balance === 0 ? 'text-red-600' :
                          tenant.balance <= 25 ? 'text-orange-600' :
                          tenant.balance <= 100 ? 'text-yellow-600' :
                          'text-green-600'
                        }>
                          {tenant.balance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-purple-600">∞</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {tenant.creditsUsedToday.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {tenant.creditsUsedThisMonth.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {tenant.lifetimeSpent.toLocaleString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Tenant credit actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDetail(tenant.tenantId)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAdjustment(tenant.tenantId)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Adjust Credits
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            navigate(`/${tenant.tenantSlug}/admin/dashboard`);
                            toast.success(`Viewing as ${tenant.tenantName}`);
                          }}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Impersonate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <Sheet open={!!detailTenantId} onOpenChange={() => closeDetail()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Tenant Credit Details</SheetTitle>
            <SheetDescription>
              View and manage credit balance for this tenant
            </SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-60 w-full" />
            </div>
          ) : detailData ? (
            <TenantCreditDetailPanel 
              detail={detailData} 
              onAdjust={() => {
                if (detailTenantId) openAdjustment(detailTenantId);
              }}
              onClose={closeDetail}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load tenant details
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Adjustment Form Dialog */}
      <CreditAdjustmentForm
        open={showAdjustForm}
        onOpenChange={setShowAdjustForm}
        tenantId={adjustTenantId || ''}
        onSuccess={() => {
          setShowAdjustForm(false);
          setAdjustTenantId(null);
          queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.tenantCredits() });
          if (detailTenantId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.tenantCreditDetail(detailTenantId) });
          }
        }}
      />

      {/* Bulk Grant Dialog */}
      <Sheet open={showBulkGrant} onOpenChange={setShowBulkGrant}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Grant Credits to {selectedTenants.length} Tenants</SheetTitle>
            <SheetDescription>
              Add credits to all selected tenant accounts
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <label className="text-sm font-medium">Credits Amount</label>
              <Input
                type="number"
                value={bulkGrantAmount}
                onChange={(e) => setBulkGrantAmount(parseInt(e.target.value) || 0)}
                min={1}
                max={10000}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Total: {(bulkGrantAmount * selectedTenants.length).toLocaleString()} credits
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => bulkGrantMutation.mutate({
                tenantIds: selectedTenants,
                amount: bulkGrantAmount,
              })}
              disabled={bulkGrantMutation.isPending || bulkGrantAmount <= 0}
            >
              {bulkGrantMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Granting...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Grant {bulkGrantAmount.toLocaleString()} Credits Each
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}







