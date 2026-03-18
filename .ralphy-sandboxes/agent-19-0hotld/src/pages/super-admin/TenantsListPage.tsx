/**
 * Tenants List Page
 * Complete tenant management with filters, table/cards view, and bulk actions
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Download,
  Plus,
  SlidersHorizontal,
  ChevronDown,
  X,
  Table2,
  LayoutGrid,
  Eye,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Ban,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { calculateHealthScore, type Tenant as LibTenant } from '@/lib/tenant';
import { getStatusColor, getStatusVariant, getPlanVariant, getHealthTextColor } from '@/lib/utils/statusColors';
import { TenantCard } from '@/components/super-admin/TenantCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SUBSCRIPTION_PLANS } from '@/utils/subscriptionPlans';
import { showInfoToast } from '@/utils/toastHelpers';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';

export default function TenantsListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Dialog states for bulk actions
  const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('starter');

  // Focus search input if requested via URL param
  useEffect(() => {
    if (searchParams.get('focus') === 'search' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchParams]);

  // Fetch tenants
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.tenantsListPage(debouncedSearch, statusFilter, planFilter),
    queryFn: async () => {
      let query = supabase.from('tenants').select('id, business_name, slug, owner_email, owner_name, phone, subscription_plan, subscription_status, trial_ends_at, stripe_customer_id, payment_method_added, mrr, limits, usage, features, white_label, status, cancelled_at, last_activity_at, onboarded, created_at, updated_at');

      if (debouncedSearch) {
        query = query.or(
          `business_name.ilike.%${escapePostgresLike(debouncedSearch)}%,owner_email.ilike.%${escapePostgresLike(debouncedSearch)}%,id.eq.${debouncedSearch}`
        );
      }

      if (statusFilter !== 'all') {
        query = query.eq('subscription_status', statusFilter);
      }

      if (planFilter !== 'all') {
        query = query.eq('subscription_plan', planFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Filter tenants by health score
  const filteredTenants = useMemo(() => {
    if (healthFilter === 'all') return tenants;

    return tenants.filter((tenant) => {
      const health = calculateHealthScore(tenant as unknown as LibTenant);
      const score = health.score;

      if (healthFilter === 'healthy') return score >= 80;
      if (healthFilter === 'warning') return score >= 50 && score < 80;
      if (healthFilter === 'at-risk') return score < 50;

      return true;
    });
  }, [tenants, healthFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTenants.length / itemsPerPage);
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTenants.slice(start, start + itemsPerPage);
  }, [filteredTenants, currentPage]);

  // Active filters for display
  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string }> = [];
    if (statusFilter !== 'all') {
      filters.push({ key: 'status', label: `Status: ${statusFilter}` });
    }
    if (planFilter !== 'all') {
      filters.push({ key: 'plan', label: `Plan: ${planFilter}` });
    }
    if (healthFilter !== 'all') {
      filters.push({ key: 'health', label: `Health: ${healthFilter}` });
    }
    return filters;
  }, [statusFilter, planFilter, healthFilter]);

  const clearFilters = () => {
    setStatusFilter('all');
    setPlanFilter('all');
    setHealthFilter('all');
    setSearchQuery('');
  };

  const toggleSelect = (tenantId: string) => {
    setSelectedTenants((prev) =>
      prev.includes(tenantId)
        ? prev.filter((id) => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTenants(paginatedTenants.map((t) => t.id));
    } else {
      setSelectedTenants([]);
    }
  };

  const clearSelection = () => {
    setSelectedTenants([]);
  };

  const handleViewTenant = useCallback((id: string) => {
    navigate(`/super-admin/tenants/${id}`);
  }, [navigate]);

  const handleLoginAsTenant = useCallback((tenantId: string) => {
    const t = paginatedTenants.find((tenant) => tenant.id === tenantId);
    if (t) {
      window.open(`/${t.slug}/admin/dashboard`, '_blank', 'noopener,noreferrer');
    }
  }, [paginatedTenants]);

  if (isLoading) {
    return <EnhancedLoadingState variant="table" message="Loading tenants..." />;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Manage all customer accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 min-w-[100px]"
            onClick={() => {
              const csv = [
                ['Business Name', 'Email', 'Plan', 'Status', 'MRR', 'Created'].join(','),
                ...tenants.map(t => [
                  t.business_name,
                  t.owner_email,
                  t.subscription_plan,
                  t.subscription_status,
                  t.mrr ?? 0,
                  t.created_at
                ].join(','))
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tenants-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              showInfoToast("Export Complete", "Tenant list downloaded");
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            className="gap-2 min-w-[100px]"
            onClick={() => navigate('/super-admin/tenants/new')}
          >
            <Plus className="h-4 w-4" />
            Create Tenant
          </Button>
        </div>
      </div>

      {/* Smart Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search tenants by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  aria-label="Search tenants"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="past_due">Past Due</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Plan Filter */}
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value={SUBSCRIPTION_PLANS.STARTER}>Starter</SelectItem>
                <SelectItem value={SUBSCRIPTION_PLANS.PROFESSIONAL}>Professional</SelectItem>
                <SelectItem value={SUBSCRIPTION_PLANS.ENTERPRISE}>Enterprise</SelectItem>
              </SelectContent>
            </Select>

            {/* Health Filter */}
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Health" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Health</SelectItem>
                <SelectItem value="healthy">Healthy (80-100)</SelectItem>
                <SelectItem value="warning">Warning (50-79)</SelectItem>
                <SelectItem value="at-risk">At Risk (&lt;50)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters (Collapsible) */}
          <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-4">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Advanced Filters
                <ChevronDown
                  className={`ml-2 h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''
                    }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Sort By</label>
                  <Select defaultValue="name">
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="mrr-desc">MRR (High to Low)</SelectItem>
                      <SelectItem value="mrr-asc">MRR (Low to High)</SelectItem>
                      <SelectItem value="health-desc">Health Score</SelectItem>
                      <SelectItem value="date-desc">Newest First</SelectItem>
                      <SelectItem value="date-asc">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {activeFilters.map((filter) => (
                <Badge key={filter.key} variant="secondary" className="gap-1">
                  {filter.label}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      if (filter.key === 'status') setStatusFilter('all');
                      if (filter.key === 'plan') setPlanFilter('all');
                      if (filter.key === 'health') setHealthFilter('all');
                    }}
                  />
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {filteredTenants.length} of {tenants.length} tenants
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'table' | 'cards')}>
          <ToggleGroupItem value="table" aria-label="Table view">
            <Table2 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="cards" aria-label="Cards view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedTenants.length > 0 &&
                        selectedTenants.length === paginatedTenants.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MRR</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTenants.map((tenant) => {
                  const health = calculateHealthScore(tenant as unknown as LibTenant);
                  const healthScore = health.score;
                  return (
                    <TableRow key={tenant.id} className="group">
                      <TableCell>
                        <Checkbox
                          checked={selectedTenants.includes(tenant.id)}
                          onCheckedChange={() => toggleSelect(tenant.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={(tenant.white_label as Record<string, unknown> | null)?.logo as string | undefined} alt={tenant.business_name as string} />
                            <AvatarFallback>
                              {(tenant.business_name as string)?.charAt(0) || 'T'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{tenant.business_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {tenant.owner_email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPlanVariant(tenant.subscription_plan as string)}>
                          {tenant.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusVariant(tenant.subscription_status as string)}
                          className={getStatusColor(tenant.subscription_status as string)}
                        >
                          {tenant.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency((tenant.mrr as number) ?? 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={healthScore}
                            className="w-16 h-2"
                          />
                          <span className={`text-sm font-medium ${getHealthTextColor(healthScore)}`}>
                            {healthScore}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatSmartDate(tenant.created_at as string)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/super-admin/tenants/${tenant.id}`)}
                                  aria-label="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    window.open(`/${tenant.slug}/admin/dashboard`, '_blank', 'noopener,noreferrer');
                                  }}
                                  aria-label="Impersonate tenant"
                                >
                                  <UserCog className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Impersonate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/super-admin/tenants/${tenant.id}?tab=settings`)}
                                  aria-label="Tenant settings"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Settings</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedTenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onView={handleViewTenant}
              onLoginAs={handleLoginAsTenant}
            />
          ))}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedTenants.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-2xl">
            <CardContent className="flex items-center gap-4 py-3 px-6">
              <span className="font-medium">{selectedTenants.length} selected</span>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="outline" size="sm" className="gap-2 min-w-[100px]" onClick={() => setChangePlanDialogOpen(true)}>
                <CreditCard className="h-4 w-4" />
                Change Plan
              </Button>
              <Button variant="outline" size="sm" className="gap-2 min-w-[100px]" onClick={() => setSuspendDialogOpen(true)}>
                <Ban className="h-4 w-4" />
                Suspend
              </Button>
              <Button variant="outline" size="sm" className="gap-2 min-w-[100px]" onClick={() => {
                const csv = [
                  ['ID', 'Business Name', 'Email', 'Plan', 'Status', 'MRR'].join(','),
                  ...tenants.filter(t => selectedTenants.includes(t.id)).map(t => [
                    t.id, t.business_name, t.owner_email, t.subscription_plan, t.subscription_status, t.mrr ?? 0
                  ].join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `selected-tenants-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                showInfoToast("Export Complete", `${selectedTenants.length} tenants exported`);
              }}>
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} aria-label="Clear selection">
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Change Plan Dialog */}
      <Dialog open={changePlanDialogOpen} onOpenChange={setChangePlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Select a new plan for {selectedTenants.length} selected tenant{selectedTenants.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="plan-select" className="mb-2 block">New Plan</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger id="plan-select">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={async () => {
              try {
                for (const tid of selectedTenants) {
                  const { error } = await supabase.from('tenants').update({ subscription_plan: selectedPlan }).eq('id', tid);
                  if (error) throw error;
                }
                clearSelection();
                setChangePlanDialogOpen(false);
                showInfoToast("Success", `${selectedTenants.length} tenants updated to ${selectedPlan}`);
              } catch (error: unknown) {
                logger.error('Failed to update tenant plans', error);
                toast.error('Failed to update some tenants', { description: humanizeError(error) });
              }
            }}>
              Update Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Confirmation Dialog */}
      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Tenants</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to suspend {selectedTenants.length} tenant{selectedTenants.length > 1 ? 's' : ''}? 
              They will not be able to log in until unsuspended.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  for (const tid of selectedTenants) {
                    const { error } = await supabase.from('tenants').update({ status: 'suspended' }).eq('id', tid);
                    if (error) throw error;
                  }
                  clearSelection();
                  setSuspendDialogOpen(false);
                  showInfoToast("Success", `${selectedTenants.length} tenants suspended`);
                } catch (error: unknown) {
                  logger.error('Failed to suspend tenants', error);
                  toast.error('Failed to suspend some tenants', { description: humanizeError(error) });
                }
              }}
            >
              Suspend {selectedTenants.length} Tenant{selectedTenants.length > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

