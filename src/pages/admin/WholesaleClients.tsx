import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { logger } from "@/lib/logger";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Phone,
  DollarSign,
  Package,
  Edit2,
  Building,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { CustomerRiskBadge } from "@/components/admin/CustomerRiskBadge";
import { ClientStatusBadge } from "@/components/admin/ClientStatusBadge";
import { CreateClientDialog } from "@/components/admin/CreateClientDialog";
import { toast } from "sonner";
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from "@/lib/queryKeys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TakeTourButton } from "@/components/tutorial/TakeTourButton";
import { SendPortalLinkDialog } from "@/components/admin/wholesale/SendPortalLinkDialog";
import { Link2 } from "lucide-react";
import { customersTutorial } from "@/lib/tutorials/tutorialConfig";
import { Database } from "@/integrations/supabase/types";
import { CustomerQuickViewCard } from "@/components/tenant-admin/CustomerQuickViewCard";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { SearchInput } from "@/components/shared/SearchInput";
import { TruncatedText } from "@/components/shared/TruncatedText";
import { sanitizeSearchInput } from "@/lib/sanitizeSearch";

type WholesaleClientRow = Database['public']['Tables']['wholesale_clients']['Row'];

interface WholesaleClient extends WholesaleClientRow {
  territory: string;
  monthly_volume_lbs: number;
  total_spent: number;
}

type ClientSortField = 'business_name' | 'outstanding_balance' | 'created_at' | 'status';
type SortOrder = 'asc' | 'desc';

import { useTablePreferences } from "@/hooks/useTablePreferences";
import CopyButton from "@/components/CopyButton";
import { ExportButton } from "@/components/ui/ExportButton";
import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";
import { usePagination } from "@/hooks/usePagination";
import { StandardPagination } from "@/components/shared/StandardPagination";

export default function WholesaleClients() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { preferences, savePreferences } = useTablePreferences("wholesale-clients-table");

  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);

  useAdminKeyboardShortcuts({
    onCreate: () => {
      setCreateClientDialogOpen(true);
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);
  const [filter, setFilter] = useState<string>(preferences.customFilters?.filter || "all");
  const [sortField, setSortField] = useState<ClientSortField>('business_name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; client?: WholesaleClient }>({ open: false });

  // Save preferences when filter changes
  useEffect(() => {
    savePreferences({ customFilters: { filter } });
  }, [filter, savePreferences]);
  const [portalLinkDialogOpen, setPortalLinkDialogOpen] = useState(false);
  const [portalLinkClient, setPortalLinkClient] = useState<WholesaleClient | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: queryKeys.wholesaleClients.list({ filter }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      let query = supabase
        .from("wholesale_clients")
        .select("id, business_name, contact_name, status, client_type, email, phone, outstanding_balance, credit_limit, address, monthly_volume, reliability_score, portal_token, created_at, tenant_id, wholesale_payments(amount)")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filter === "active") {
        query = query.eq("status", "active");
      } else if (filter === "credit_approved") {
        query = query.gt("credit_limit", 0);
      } else if (filter === "high_balance") {
        query = query.gt("outstanding_balance", 0);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Wholesale clients are NOT encrypted - use plaintext fields directly
      // Map to expected format
      return (data ?? []).map((client) => ({
        ...client,
        territory: (client.address || '').split(',')[1]?.trim() || 'Unknown',
        monthly_volume_lbs: client.monthly_volume,
        total_spent: client.wholesale_payments?.reduce((sum: number, p: { amount: number | null }) => sum + (Number(p.amount) || 0), 0) || 0
      })) as WholesaleClient[];
    }
  });

  const sanitizedSearch = sanitizeSearchInput(searchTerm).toLowerCase();
  const filteredClients = useMemo(() => clients?.filter(client =>
    client.business_name.toLowerCase().includes(sanitizedSearch) ||
    client.contact_name.toLowerCase().includes(sanitizedSearch)
  ) ?? [], [clients, sanitizedSearch]);

  const handleSort = (field: ClientSortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const SortableHeader = ({ field, label }: { field: ClientSortField; label: string }) => {
    const isActive = sortField === field;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 hover:bg-transparent"
        onClick={() => handleSort(field)}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    );
  };

  const sortedClients = useMemo(() => {
    const sorted = [...filteredClients];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'business_name':
          cmp = (a.business_name || '').localeCompare(b.business_name || '');
          break;
        case 'outstanding_balance':
          cmp = (Number(a.outstanding_balance) || 0) - (Number(b.outstanding_balance) || 0);
          break;
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredClients, sortField, sortOrder]);

  const {
    paginatedItems: paginatedClients,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(sortedClients, {
    defaultPageSize: 25,
    persistInUrl: true,
    urlKey: 'clients',
  });

  // Reset to page 1 when search, filter, or sort changes
  useEffect(() => {
    goToPage(1);
  }, [searchTerm, filter, sortField, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const getClientTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      sub_dealer: "Sub-Dealer",
      small_shop: "Small Shop",
      network: "Network/Crew",
      supplier: "Supplier"
    };
    return types[type] || type;
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.list({ filter }) });
  };

  const updateClientMutation = useMutation({
    mutationFn: async ({ clientId, updates }: { clientId: string; updates: Record<string, unknown> }) => {
      if (!tenant?.id) throw new Error("Tenant context required");

      const { error } = await supabase
        .from('wholesale_clients')
        .update(updates)
        .eq('id', clientId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client updated successfully");
      handleRefresh();
    },
    onError: (error) => {
      logger.error('Error updating client:', error);
      toast.error("Failed to update client", { description: humanizeError(error) });
    },
  });

  const handleUpdateClient = (clientId: string, updates: Record<string, unknown>) => {
    updateClientMutation.mutate({ clientId, updates });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="w-full max-w-full space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground">Wholesale Clients</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">B2B Relationships & Credit Management</p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <ExportButton
              data={filteredClients ?? []}
              filename="wholesale-clients"
              columns={[
                { key: "business_name", label: "Business Name" },
                { key: "contact_name", label: "Contact Name" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "client_type", label: "Type" },
                { key: "status", label: "Status" },
                { key: "credit_limit", label: "Credit Limit" },
                { key: "outstanding_balance", label: "Outstanding Balance" },
                { key: "territory", label: "Territory" },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              className="min-h-[48px] touch-manipulation flex-1 sm:flex-initial min-w-[100px]"
              disabled={updateClientMutation.isPending}
              onClick={() => setImportDialogOpen(true)}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation flex-1 sm:flex-initial min-w-[100px]"
              disabled={updateClientMutation.isPending}
              onClick={() => setCreateClientDialogOpen(true)}
              data-tutorial="add-customer"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="text-sm sm:text-base">New Client</span>
            </Button>
            <TakeTourButton
              tutorialId={customersTutorial.id}
              steps={customersTutorial.steps}
              variant="outline"
              size="sm"
              className="min-h-[48px]"
            />
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
            {/* Search */}
            <div className="flex-1">
              <SearchInput
                placeholder="Search clients..."
                onSearch={handleSearch}
                className="min-h-[44px]"
                delay={300}
                isLoading={isLoading}
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                className="min-h-[44px] touch-manipulation text-xs sm:text-sm"
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                variant={filter === "active" ? "default" : "outline"}
                size="sm"
                className="min-h-[44px] touch-manipulation text-xs sm:text-sm"
                onClick={() => setFilter("active")}
              >
                Active
              </Button>
              <Button
                variant={filter === "credit_approved" ? "default" : "outline"}
                size="sm"
                className="min-h-[44px] touch-manipulation text-xs sm:text-sm"
                onClick={() => setFilter("credit_approved")}
              >
                Credit Approved
              </Button>
              <Button
                variant={filter === "high_balance" ? "default" : "outline"}
                size="sm"
                className="min-h-[44px] touch-manipulation text-xs sm:text-sm border-amber-500 text-amber-600 hover:bg-amber-500 hover:text-white"
                onClick={() => setFilter("high_balance")}
              >
                High Balance
              </Button>
            </div>
          </div>
        </Card>

        {/* Clients Table */}
        <Card className="overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <Table data-tutorial="customer-list" className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm"><SortableHeader field="business_name" label="Client" /></TableHead>
                    <TableHead className="text-xs sm:text-sm"><SortableHeader field="status" label="Status" /></TableHead>
                    <TableHead className="text-xs sm:text-sm">Type</TableHead>
                    <TableHead className="text-xs sm:text-sm">Contact</TableHead>
                    <TableHead className="text-xs sm:text-sm"><SortableHeader field="outstanding_balance" label="Credit Status" /></TableHead>
                    <TableHead className="text-xs sm:text-sm">Reliability</TableHead>
                    <TableHead className="text-xs sm:text-sm"><SortableHeader field="created_at" label="This Month" /></TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedClients.length > 0 ? (
                    paginatedClients.map((client) => (
                      <TableRow
                        key={client.id}
                        className="cursor-pointer hover:bg-muted/50 touch-manipulation"
                        onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/big-plug-clients/${client.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tenant?.slug && navigate(`/${tenant.slug}/admin/big-plug-clients/${client.id}`); } }}
                      >
                        <TableCell className="text-xs sm:text-sm max-w-[200px]">
                          <div className="max-w-[200px] min-w-0">
                            <div className="font-semibold text-foreground flex items-center gap-2 min-w-0">
                              <CustomerQuickViewCard customer={client}>
                                <TruncatedText text={client.business_name} className="font-semibold" maxWidthClass="max-w-[200px]" />
                              </CustomerQuickViewCard>
                              <CopyButton text={client.id} label="Client ID" showLabel={false} className="h-4 w-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <TruncatedText text={client.territory} className="text-xs text-muted-foreground" maxWidthClass="max-w-[200px]" />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <ClientStatusBadge status={client.status || 'active'} />
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <Select
                            defaultValue={client.client_type}
                            onValueChange={(value) => handleUpdateClient(client.id, { client_type: value })}
                            disabled={updateClientMutation.isPending}
                          >
                            <SelectTrigger className="h-8 w-[100px] border-none bg-transparent hover:bg-muted/50 focus-visible:ring-0 p-0">
                              <SelectValue>
                                <Badge variant="outline" className="text-xs pointer-events-none">
                                  {getClientTypeLabel(client.client_type)}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sub_dealer">Sub-Dealer</SelectItem>
                              <SelectItem value="small_shop">Small Shop</SelectItem>
                              <SelectItem value="network">Network/Crew</SelectItem>
                              <SelectItem value="supplier">Supplier</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[200px]">
                          <div className="max-w-[200px] min-w-0">
                            <TruncatedText text={client.contact_name} className="text-xs sm:text-sm text-foreground" maxWidthClass="max-w-[200px]" />
                            <div className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                              {client.email && (
                                <>
                                  <TruncatedText text={client.email} className="text-xs text-muted-foreground" maxWidthClass="max-w-[200px]" />
                                  <CopyButton text={client.email} label="Email" showLabel={false} className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </>
                              )}
                            </div>
                            {client.phone && (
                              <TruncatedText text={client.phone} className="text-xs text-muted-foreground" maxWidthClass="max-w-[200px]" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors group/credit">
                                <ClientStatusBadge
                                  status=""
                                  type="credit"
                                  balance={Number(client.outstanding_balance)}
                                  creditLimit={Number(client.credit_limit || 0)}
                                  className="mb-1"
                                />
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  ${Number(client.outstanding_balance).toLocaleString()} / ${Number(client.credit_limit || 0).toLocaleString()}
                                  <Edit2 className="h-3 w-3 opacity-0 group-hover/credit:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-60">
                              <div className="space-y-2">
                                <h4 className="font-medium leading-none">Credit Limit</h4>
                                <p className="text-sm text-muted-foreground">Set credit limit for this client.</p>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    defaultValue={client.credit_limit || 0}
                                    aria-label="Credit limit"
                                    className="h-8"
                                    disabled={updateClientMutation.isPending}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateClientMutation.mutate(
                                          { clientId: client.id, updates: { credit_limit: Number(e.currentTarget.value) } },
                                          {
                                            onSuccess: () => {
                                              toast.success('Credit limit updated');
                                              handleRefresh();
                                            },
                                            onError: (error) => {
                                              logger.error('Error updating credit limit:', error);
                                              toast.error('Failed to update credit limit', { description: humanizeError(error) });
                                            },
                                          }
                                        );
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (val !== client.credit_limit) {
                                        updateClientMutation.mutate(
                                          { clientId: client.id, updates: { credit_limit: val } },
                                          {
                                            onSuccess: () => {
                                              toast.success('Credit limit updated');
                                              handleRefresh();
                                            },
                                            onError: (error) => {
                                              logger.error('Error updating credit limit:', error);
                                              toast.error('Failed to update credit limit', { description: humanizeError(error) });
                                            },
                                          }
                                        );
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <CustomerRiskBadge
                            score={client.reliability_score ?? null}
                            showLabel={true}
                          />
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div>
                            <div className="text-xs sm:text-sm font-mono text-foreground">
                              {Number(client.monthly_volume_lbs).toFixed(0)} lbs
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ${Number(client.total_spent).toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-[48px] min-w-[48px] touch-manipulation"
                              disabled={updateClientMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPortalLinkClient(client);
                                setPortalLinkDialogOpen(true);
                              }}
                              title="Send Portal Link"
                            >
                              <Link2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-[48px] min-w-[48px] touch-manipulation"
                              disabled={updateClientMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (client.phone) {
                                  window.location.href = `tel:${client.phone}`;
                                } else {
                                  toast.error("No phone number available");
                                }
                              }}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            {client.outstanding_balance > 0 && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="min-h-[48px] min-w-[48px] touch-manipulation"
                                disabled={updateClientMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentDialog({ open: true, client });
                                }}
                              >
                                <DollarSign className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Collect</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              className="min-h-[48px] touch-manipulation"
                              disabled={updateClientMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (tenant?.slug) {
                                  navigate(`/${tenant.slug}/admin/wholesale-orders/new?clientId=${client.id}`);
                                }
                              }}
                            >
                              <Package className="h-4 w-4 sm:mr-1" />
                              <span className="hidden sm:inline">New Order</span>
                              <span className="sm:hidden">Order</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-96 text-center">
                        <EnhancedEmptyState
                          icon={Building}
                          title={searchTerm ? "No Clients Found" : "No wholesale clients yet"}
                          description={searchTerm ? "No clients found matching your search criteria." : "Add clients to manage wholesale relationships"}
                          primaryAction={{
                            label: "Add Client",
                            onClick: () => setCreateClientDialogOpen(true),
                            icon: Plus
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Desktop Pagination */}
          {totalItems > 0 && (
            <StandardPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
              pageSizeOptions={pageSizeOptions}
            />
          )}
        </Card>

        {/* Mobile Card View */}
        <Card className="md:hidden">
          <div className="space-y-3 p-4">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : paginatedClients.length > 0 ? (
              paginatedClients.map((client) => (
                <Card
                  key={client.id}
                  className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
                  onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/big-plug-clients/${client.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tenant?.slug && navigate(`/${tenant.slug}/admin/big-plug-clients/${client.id}`); } }}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ClientStatusBadge status={client.status || 'active'} showIcon={false} className="text-[10px] px-1.5 h-5" />
                          <TruncatedText text={client.business_name} className="font-semibold text-base" maxWidthClass="max-w-[180px]" />
                        </div>
                        <TruncatedText text={client.territory} className="text-sm text-muted-foreground" maxWidthClass="max-w-[180px]" />
                        <Badge variant="outline" className="text-xs mt-1">{getClientTypeLabel(client.client_type)}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</div>
                        <div className="text-sm">
                          <TruncatedText text={client.contact_name} className="text-sm" maxWidthClass="max-w-[180px]" />
                          <TruncatedText text={client.phone || ''} className="text-muted-foreground text-sm" maxWidthClass="max-w-[180px]" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credit Status</div>
                        <ClientStatusBadge
                          status=""
                          type="credit"
                          balance={Number(client.outstanding_balance)}
                          creditLimit={Number(client.credit_limit || 0)}
                        />
                        <div className="text-xs text-muted-foreground mt-1 font-mono">
                          ${Number(client.outstanding_balance).toLocaleString()} / ${Number(client.credit_limit || 0).toLocaleString()} limit
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reliability</div>
                          <CustomerRiskBadge
                            score={client.reliability_score ?? null}
                            showLabel={true}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Month</div>
                          <div className="text-sm font-mono">{Number(client.monthly_volume_lbs).toFixed(0)} lbs</div>
                          <div className="text-xs text-muted-foreground">${Number(client.total_spent).toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-[48px] min-w-[48px] flex-1 min-w-[100px]"
                          disabled={updateClientMutation.isPending}
                          onClick={() => {
                            if (client.phone) {
                              window.location.href = `tel:${client.phone}`;
                            } else {
                              toast.error("No phone number available");
                            }
                          }}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          <span className="text-xs">Call</span>
                        </Button>
                        {client.outstanding_balance > 0 && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="min-h-[48px] flex-1 min-w-[100px]"
                            disabled={updateClientMutation.isPending}
                            onClick={() => {
                              setPaymentDialog({ open: true, client });
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            <span className="text-xs">Collect</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="default"
                          className="min-h-[48px] flex-1 min-w-[100px]"
                          disabled={updateClientMutation.isPending}
                          onClick={() => {
                            if (tenant?.slug) {
                              navigate(`/${tenant.slug}/admin/wholesale-orders/new?clientId=${client.id}`);
                            }
                          }}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          <span className="text-xs">New Order</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="py-8">
                <EnhancedEmptyState
                  icon={Building}
                  title={searchTerm ? "No Clients Found" : "No wholesale clients yet"}
                  description={searchTerm ? "No clients found matching your search criteria." : "Add clients to manage wholesale relationships"}
                  primaryAction={{
                    label: "Add Client",
                    onClick: () => setCreateClientDialogOpen(true),
                    icon: Plus
                  }}
                />
              </div>
            )}
          </div>

          {/* Mobile Pagination */}
          {totalItems > 0 && (
            <StandardPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
              pageSizeOptions={pageSizeOptions}
              showPageSizeSelector={false}
            />
          )}
        </Card>

        {/* Payment Dialog */}
        {paymentDialog.client && (
          <PaymentDialog
            clientId={paymentDialog.client.id}
            clientName={paymentDialog.client.business_name}
            outstandingBalance={paymentDialog.client.outstanding_balance}
            open={paymentDialog.open}
            onOpenChange={(open) => setPaymentDialog({ open, client: open ? paymentDialog.client : undefined })}
          />
        )}

        {/* Send Portal Link Dialog */}
        {portalLinkClient && (
          <SendPortalLinkDialog
            open={portalLinkDialogOpen}
            onOpenChange={(open) => {
              setPortalLinkDialogOpen(open);
              if (!open) setPortalLinkClient(null);
            }}
            client={portalLinkClient}
          />
        )}

        {/* Create Client Dialog */}
        <CreateClientDialog
          open={createClientDialogOpen}
          onOpenChange={setCreateClientDialogOpen}
          onSuccess={() => {
            // Query will automatically refetch due to cache invalidation
          }}
        />

        {/* Import Clients Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Import Clients from CSV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Upload a CSV file with columns: business_name, contact_name, email, phone, address, credit_limit
              </div>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="min-h-[44px]"
                aria-label="Upload CSV file for client import"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Download template
                    const template = "business_name,contact_name,email,phone,address,credit_limit\nAcme Corp,John Doe,john@acme.com,555-1234,123 Main St,10000";
                    const blob = new Blob([template], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'client-import-template.csv';
                    a.click();
                  }}
                  className="flex-1 min-h-[44px]"
                >
                  Download Template
                </Button>
                <Button
                  onClick={async () => {
                    if (!importFile || !tenant?.id) return;
                    setImporting(true);
                    try {
                      const text = await importFile.text();
                      const lines = text.split('\n').filter(l => l.trim());
                      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

                      let imported = 0;
                      for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',');
                        const client: Record<string, string | number> = { tenant_id: tenant.id };
                        headers.forEach((header, idx) => {
                          const value = values[idx]?.trim() || '';
                          if (header === 'credit_limit') {
                            client[header] = parseFloat(value) || 0;
                          } else {
                            client[header] = value;
                          }
                        });

                        if (client.business_name && client.contact_name) {
                          const { error } = await supabase.from('wholesale_clients').insert([{
                            tenant_id: tenant.id,
                            business_name: String(client.business_name),
                            contact_name: String(client.contact_name),
                            email: String(client.email || ''),
                            phone: String(client.phone || ''),
                            address: String(client.address || ''),
                            credit_limit: Number(client.credit_limit) || 0,
                            client_type: 'wholesale',
                            status: 'active'
                          }]);
                          if (error) {
                            logger.warn('Failed to import wholesale client', {
                              component: 'WholesaleClients',
                              businessName: String(client.business_name),
                              error,
                            });
                          } else {
                            imported++;
                          }
                        }
                      }

                      toast.success(`Imported ${imported} clients successfully`);
                      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.lists() });
                      setImportDialogOpen(false);
                      setImportFile(null);
                    } catch (error) {
                      logger.error('Import failed', error);
                      toast.error('Failed to import clients', { description: humanizeError(error) });
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={!importFile || importing || updateClientMutation.isPending}
                  className="flex-1 min-h-[44px]"
                >
                  {importing ? 'Importing...' : 'Import'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}
