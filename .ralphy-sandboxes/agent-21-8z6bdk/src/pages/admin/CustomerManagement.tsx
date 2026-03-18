import { logger } from '@/lib/logger';
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { queryKeys } from "@/lib/queryKeys";
import { invalidateOnEvent } from "@/lib/invalidation";
import { formatCurrency, formatSmartDate, displayName } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users, Plus, DollarSign, Award, TrendingUp, UserCircle,
  MoreHorizontal, Edit, Trash, Eye, Filter, Download, Upload, Mail, Lock, Phone
} from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { TooltipGuide } from "@/components/shared/TooltipGuide";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTenantFeatureToggles } from "@/hooks/useTenantFeatureToggles";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { StandardPagination } from "@/components/shared/StandardPagination";
import { useEncryption } from "@/lib/hooks/useEncryption";
import { motion } from "framer-motion";
import { SwipeableItem } from "@/components/mobile/SwipeableItem";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { triggerHaptic } from "@/lib/utils/mobile";
import { cn } from "@/lib/utils";
import { CustomerImportDialog } from "@/components/admin/CustomerImportDialog";
import CopyButton from "@/components/CopyButton";
import { CustomerTagFilter } from "@/components/admin/customers/CustomerTagFilter";
import { CustomerTagBadges } from "@/components/admin/customers/CustomerTagBadges";
import { useContactTagsBatch } from "@/hooks/useCustomerTags";
import { TruncatedText } from "@/components/shared/TruncatedText";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable';
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar';
import type { ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { escapePostgresLike } from '@/lib/utils/searchSanitize';

import { useCustomersByTags } from "@/hooks/useAutoTagRules";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  customer_type: string;
  total_spent: number;
  loyalty_points: number;
  loyalty_tier: string;
  last_purchase_at: string | null;
  status: string;
  medical_card_expiration: string | null;
  /** Indicates data is encrypted but cannot be decrypted with current key */
  _encryptedIndicator?: boolean;
}

interface CustomerListResult {
  customers: Customer[];
  totalCount: number;
}

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Detects if a value looks like encrypted ciphertext (Base64 encoded)
 * Used to show encrypted indicator when decryption key mismatch occurs
 */
const looksLikeEncryptedData = (value: string | null): boolean => {
  if (!value) return false;
  // CryptoJS AES encrypted strings are Base64 and typically start with "U2FsdGVk" (Salted__)
  // or are long Base64 strings without spaces/normal text patterns
  const base64Pattern = /^[A-Za-z0-9+/=]{20,}$/;
  const saltedPrefix = value.startsWith('U2FsdGVk');
  return saltedPrefix || (base64Pattern.test(value) && value.length > 40);
};

export function CustomerManagement() {
  const navigate = useNavigate();
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const { decryptObject, isReady: encryptionIsReady } = useEncryption();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<Customer | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const searchInteractionStartRef = useRef<number | null>(null);
  const { isEnabled: isFeatureEnabled } = useTenantFeatureToggles();
  const { canEdit, canDelete, canExport } = usePermissions();
  const posEnabled = isFeatureEnabled('pos');

  // Server-side pagination state via URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get('customers') ?? '1', 10));
  const pageSize = parseInt(searchParams.get('customersSize') ?? String(DEFAULT_PAGE_SIZE), 10);

  const goToPage = useCallback((page: number) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (page > 1) {
        params.set('customers', String(page));
      } else {
        params.delete('customers');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const changePageSize = useCallback((newSize: number) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      // Reset to page 1 when changing page size
      params.delete('customers');
      if (newSize !== DEFAULT_PAGE_SIZE) {
        params.set('customersSize', String(newSize));
      } else {
        params.delete('customersSize');
      }
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    if (currentPage > 1) {
      goToPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, filterType, filterStatus]);

  // Get customer IDs filtered by tags
  const { data: customerIdsByTags } = useCustomersByTags(filterTagIds);

  const { data: customerResult, isLoading: loading } = useQuery({
    queryKey: queryKeys.customers.list(tenant?.id, {
      filterType,
      filterStatus,
      search: debouncedSearchTerm,
      page: currentPage,
      pageSize,
    }),
    queryFn: async (): Promise<CustomerListResult> => {
      if (!tenant) return { customers: [], totalCount: 0 };

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("customers")
        .select("id, tenant_id, first_name, last_name, email, phone, customer_type, total_spent, loyalty_points, loyalty_tier, last_purchase_at, status, medical_card_expiration, phone_encrypted, email_encrypted, deleted_at, created_at", { count: 'exact' })
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null);

      if (filterType !== "all") {
        query = query.eq("customer_type", filterType);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Server-side search across name, email, and phone
      if (debouncedSearchTerm) {
        const escaped = escapePostgresLike(debouncedSearchTerm);
        query = query.or(
          `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`
        );
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Decrypt customer data if encryption is ready and encrypted fields exist
      let decryptedCustomers: Record<string, unknown>[] = data ?? [];
      const firstRecord = data?.[0] as Record<string, unknown> | undefined;
      if (encryptionIsReady && data && data.length > 0 && (firstRecord?.phone_encrypted || firstRecord?.email_encrypted)) {
        try {
          decryptedCustomers = data.map((customer: Record<string, unknown>) => {
            try {
              const decrypted = decryptObject(customer as Record<string, string>);
              // Map decrypted fields to Customer interface
              const nameParts = typeof decrypted.name === 'string' ? decrypted.name.split(' ') : ['', ''];
              return {
                ...customer,
                first_name: nameParts[0] ?? customer.first_name ?? '',
                last_name: nameParts.slice(1).join(' ') ?? customer.last_name ?? '',
                email: decrypted.email || customer.email || null,
                phone: decrypted.phone || customer.phone || null,
              };
            } catch (decryptError) {
              // Decryption failed - check if data looks encrypted (key mismatch)
              logger.warn('Failed to decrypt customer, checking for encryption key mismatch', decryptError instanceof Error ? decryptError : new Error(String(decryptError)), { component: 'CustomerManagement' });

              const emailValue = customer.email as string | null;
              const phoneValue = customer.phone as string | null;
              const hasEncryptedData = looksLikeEncryptedData(emailValue) || looksLikeEncryptedData(phoneValue);

              return {
                ...customer,
                // If data looks encrypted, show placeholder instead of ciphertext
                email: hasEncryptedData && looksLikeEncryptedData(emailValue) ? null : emailValue,
                phone: hasEncryptedData && looksLikeEncryptedData(phoneValue) ? null : phoneValue,
                _encryptedIndicator: hasEncryptedData,
              };
            }
          });
        } catch (decryptionError) {
          logger.warn('Failed to decrypt customers, using plaintext', decryptionError instanceof Error ? decryptionError : new Error(String(decryptionError)), { component: 'CustomerManagement' });
          decryptedCustomers = data ?? [];
        }
      } else if (data && data.length > 0) {
        // Encryption not ready but data may have encrypted fields - check for ciphertext
        decryptedCustomers = data.map((customer: Record<string, unknown>) => {
          const emailValue = customer.email as string | null;
          const phoneValue = customer.phone as string | null;
          const hasEncryptedData = looksLikeEncryptedData(emailValue) || looksLikeEncryptedData(phoneValue);

          if (hasEncryptedData) {
            return {
              ...customer,
              email: looksLikeEncryptedData(emailValue) ? null : emailValue,
              phone: looksLikeEncryptedData(phoneValue) ? null : phoneValue,
              _encryptedIndicator: true,
            };
          }
          return customer;
        });
      }

      return {
        customers: decryptedCustomers as unknown as Customer[],
        totalCount: count ?? 0,
      };
    },
    enabled: !!tenant && !accountLoading,
  });

  const customers = customerResult?.customers ?? [];
  const totalCount = customerResult?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Separate lightweight stats query (unaffected by pagination/search)
  const { data: statsData } = useQuery({
    queryKey: queryKeys.customers.list(tenant?.id, { _stats: true }),
    queryFn: async () => {
      if (!tenant) return { total: 0, active: 0, medical: 0, revenue: 0, atRisk: 0 };

      const { data, error } = await supabase
        .from("customers")
        .select("status, customer_type, total_spent, last_purchase_at")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null);

      if (error) throw error;

      const rows = data ?? [];
      const total = rows.length;
      const active = rows.filter(c => c.status === 'active').length;
      const medical = rows.filter(c => c.customer_type === 'medical').length;
      const revenue = rows.reduce((sum, c) => sum + ((c.total_spent as number) ?? 0), 0);
      const atRisk = rows.filter(c => {
        if (!c.last_purchase_at) return false;
        const days = Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
        return days > 60;
      }).length;

      return { total, active, medical, revenue, atRisk };
    },
    enabled: !!tenant && !accountLoading,
    staleTime: 30_000, // Stats don't need to refresh as often
  });

  const handleDeleteClick = useCallback((customerId: string, customerName: string) => {
    triggerHaptic('medium');
    setCustomerToDelete({ id: customerId, name: customerName });
    setDeleteDialogOpen(true);
  }, []);

  const handleDelete = async () => {
    if (!customerToDelete || !tenant) return;

    // Snapshot current cache and optimistically remove customer
    const queryKey = queryKeys.customers.list(tenant.id, {
      filterType,
      filterStatus,
      search: debouncedSearchTerm,
      page: currentPage,
      pageSize,
    });
    const previousResult = queryClient.getQueryData<CustomerListResult>(queryKey);
    queryClient.setQueryData<CustomerListResult>(queryKey, (old) =>
      old ? {
        customers: old.customers.filter((c) => c.id !== customerToDelete.id),
        totalCount: old.totalCount - 1,
      } : old
    );

    // Close dialog and drawer immediately for snappy UX
    setDeleteDialogOpen(false);
    setSelectedCustomerForDrawer(null);

    try {
      setIsDeleting(true);

      // Check if customer has existing orders
      const { count: orderCount } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true })
        .eq("customer_id", customerToDelete.id)
        .eq("tenant_id", tenant.id);

      if (orderCount && orderCount > 0) {
        // Customer has orders - use soft delete
        const { error } = await supabase
          .from("customers")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", customerToDelete.id)
          .eq("tenant_id", tenant.id);

        if (error) throw error;

        triggerHaptic('light');
        toast.success("Customer archived successfully", {
          description: `Customer has ${orderCount} order(s) and was archived instead of permanently deleted.`
        });
      } else {
        // No orders - can soft delete (keeping data for audit)
        const { error } = await supabase
          .from("customers")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", customerToDelete.id)
          .eq("tenant_id", tenant.id);

        if (error) throw error;

        triggerHaptic('light');
        toast.success("Customer deleted successfully");
      }

      invalidateOnEvent(queryClient, 'CUSTOMER_DELETED', tenant.id, { customerId: customerToDelete.id });
      setCustomerToDelete(null);
    } catch (error: unknown) {
      // Rollback optimistic update on failure
      if (previousResult) {
        queryClient.setQueryData(queryKey, previousResult);
      }
      logger.error("Failed to delete customer", error, { component: "CustomerManagement" });
      toast.error("Failed to delete customer", {
        description: error instanceof Error ? error.message : "An error occurred"
      });
    } finally {
      setIsDeleting(false);
      // Always re-fetch from server to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    }
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Email", "Phone", "Type", "Total Spent", "Loyalty Points", "Status"],
      ...displayedCustomers.map(c => [
        displayName(c.first_name, c.last_name),
        c.email ?? '',
        c.phone ?? '',
        c.customer_type,
        c.total_spent,
        c.loyalty_points,
        c.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Customer data exported");
  };

  // Apply client-side tag filtering on server-paginated results
  const displayedCustomers = useMemo(() => {
    if (filterTagIds.length === 0) return customers;
    return customers.filter((customer) =>
      customerIdsByTags && customerIdsByTags.includes(customer.id)
    );
  }, [customers, filterTagIds, customerIdsByTags]);

  useEffect(() => {
    if (!debouncedSearchTerm) return;
    searchInteractionStartRef.current = performance.now();
  }, [searchTerm, debouncedSearchTerm]);

  useEffect(() => {
    if (searchInteractionStartRef.current === null || !debouncedSearchTerm) return;
    const duration = performance.now() - searchInteractionStartRef.current;
    performance.mark('customers-filter-end');
    if (import.meta.env.DEV) {
      logger.debug('[perf] customer filter latency', {
        durationMs: Math.round(duration),
        resultCount: displayedCustomers.length,
      });
    }
    searchInteractionStartRef.current = null;
  }, [displayedCustomers, debouncedSearchTerm]);

  // Batch-fetch tags for visible rows to avoid N+1 tag queries.
  const visibleCustomerIds = useMemo(
    () => displayedCustomers.map((customer) => customer.id),
    [displayedCustomers]
  );
  const { data: visibleTagsByCustomer = {} } = useContactTagsBatch(visibleCustomerIds);

  // Stats from separate lightweight query
  const totalCustomers = statsData?.total ?? 0;
  const activeCustomers = statsData?.active ?? 0;
  const medicalPatients = statsData?.medical ?? 0;
  const totalRevenue = statsData?.revenue ?? 0;
  const avgLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const atRiskCount = statsData?.atRisk ?? 0;

  const getCustomerStatus = (customer: Customer) => {
    if (!customer.last_purchase_at) return <Badge variant="outline">New</Badge>;

    const daysSince = Math.floor(
      (Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince > 60) return <Badge variant="destructive">At Risk</Badge>;
    if (daysSince <= 7) return <Badge className="bg-green-600">Active</Badge>;
    return <Badge variant="secondary">Regular</Badge>;
  };

  const customerColumns = useMemo<ResponsiveColumn<Customer>[]>(() => [
    {
      header: 'Customer',
      accessorKey: 'first_name',
      cell: (customer) => (
        <div className="flex items-center min-w-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
            {customer.first_name?.[0] ?? ''}{customer.last_name?.[0] ?? '?'}
          </div>
          <div className="ml-4 min-w-0">
            <TruncatedText
              text={displayName(customer.first_name, customer.last_name)}
              className="text-sm font-medium"
              maxWidthClass="max-w-[200px]"
              as="div"
            />
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              {customer._encryptedIndicator ? (
                <span className="flex items-center gap-1 text-amber-600" title="Contact info encrypted - sign in to view">
                  <Lock className="w-3 h-3" />
                  <span className="italic">Encrypted</span>
                </span>
              ) : (
                <>
                  <TruncatedText
                    text={customer.email || customer.phone || 'No contact'}
                    className="text-sm text-muted-foreground"
                    maxWidthClass="max-w-[200px]"
                    as="span"
                  />
                  {customer.email && (
                    <CopyButton text={customer.email} label="Email" showLabel={false} size="icon" variant="ghost" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Type',
      accessorKey: 'customer_type',
      cell: (customer) => (
        <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'}>
          {customer.customer_type === 'medical' ? 'Medical' : 'Recreational'}
        </Badge>
      )
    },
    {
      header: 'Total Spent',
      accessorKey: 'total_spent',
      cell: (customer) => <span className="text-sm font-semibold">{formatCurrency(customer.total_spent)}</span>
    },
    {
      header: 'Points',
      accessorKey: 'loyalty_points',
      cell: (customer) => (
        <span className="flex items-center gap-1">
          <Award className="w-4 h-4 text-yellow-600" />
          {customer.loyalty_points ?? 0}
        </span>
      )
    },
    {
      header: 'Last Order',
      accessorKey: 'last_purchase_at',
      cell: (customer) => <span className="text-sm text-muted-foreground">{customer.last_purchase_at ? formatSmartDate(customer.last_purchase_at) : 'Never'}</span>
    },
    {
      header: 'Tags',
      accessorKey: 'id',
      cell: (customer) => (
        <CustomerTagBadges
          customerId={customer.id}
          maxVisible={2}
          tags={visibleTagsByCustomer[customer.id]}
          showLoading={!visibleTagsByCustomer[customer.id]}
        />
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (customer) => getCustomerStatus(customer)
    },
    {
      header: 'Actions',
      accessorKey: 'id',
      cell: (customer) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/customers/${customer.id}`)}>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {canEdit('customers') && (
              <DropdownMenuItem onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/customer-management/${customer.id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {canEdit('orders') && (
              <DropdownMenuItem
                disabled={!posEnabled}
                title={!posEnabled ? 'Enable POS in Settings' : undefined}
                onClick={() => posEnabled && tenant?.slug && navigate(`/${tenant.slug}/admin/pos?customer=${customer.id}`)}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                New Order
              </DropdownMenuItem>
            )}
            {canDelete('customers') && (
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => handleDeleteClick(customer.id, displayName(customer.first_name, customer.last_name))}
              >
                <Trash className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ], [tenant?.slug, navigate, canEdit, canDelete, posEnabled, handleDeleteClick, visibleTagsByCustomer]);

  if (accountLoading || loading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto p-4 sm:p-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {["", "Customer", "Type", "Total Spent", "Points", "Last Order", "Tags", "Status", "Actions"].map((h, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-3 w-16" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, rowIdx) => (
                  <TableRow key={rowIdx}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderMobileItem = (customer: Customer) => (
    <SwipeableItem
      key={customer.id}
      leftAction={{
        icon: <Trash className="h-5 w-5" />,
        color: 'bg-red-500',
        label: 'Delete',
        onClick: () => handleDeleteClick(customer.id, displayName(customer.first_name, customer.last_name))
      }}
      rightAction={{
        icon: <Eye className="h-5 w-5" />,
        color: 'bg-blue-500',
        label: 'View',
        onClick: () => tenant?.slug && navigate(`/${tenant.slug}/admin/customers/${customer.id}`)
      }}
    >
      <div
        className="p-4 bg-card rounded-lg border shadow-sm active:scale-[0.98] transition-transform"
        onClick={() => {
          triggerHaptic('light');
          setSelectedCustomerForDrawer(customer);
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
              {customer.first_name?.[0]}{customer.last_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <TruncatedText
                text={`${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || 'Unknown'}
                className="font-semibold text-base"
                as="p"
              />
              <div className="text-sm text-muted-foreground">
                {customer._encryptedIndicator ? (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Lock className="w-3 h-3" />
                    <span className="italic">Encrypted</span>
                  </span>
                ) : (
                  <TruncatedText
                    text={customer.email || customer.phone || 'No contact'}
                    className="text-sm text-muted-foreground"
                    maxWidthClass="max-w-[180px]"
                    as="span"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                  {customer.customer_type === 'medical' ? 'Medical' : 'Rec'}
                </Badge>
                {getCustomerStatus(customer)}
                <CustomerTagBadges
                  customerId={customer.id}
                  maxVisible={2}
                  size="sm"
                  tags={visibleTagsByCustomer[customer.id]}
                  showLoading={!visibleTagsByCustomer[customer.id]}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-bold">{formatCurrency(customer.total_spent)}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Award className="w-3 h-3 text-yellow-600" />
              {customer.loyalty_points ?? 0}
            </div>
          </div>
        </div>
      </div>
    </SwipeableItem>
  );

  const stats = [
    {
      title: "Total Customers",
      value: totalCustomers,
      sub: `${activeCustomers} active`,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Medical Patients",
      value: medicalPatients,
      sub: `${totalCustomers > 0 ? Math.round((medicalPatients / totalCustomers) * 100) : 0}% of total`,
      icon: UserCircle,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      sub: "Lifetime",
      icon: DollarSign,
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "Avg LTV",
      value: formatCurrency(avgLifetimeValue),
      sub: "Per customer",
      icon: TrendingUp,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      title: "At Risk",
      value: atRiskCount,
      sub: "60+ days inactive",
      icon: Award,
      color: "text-red-500",
      bg: "bg-red-500/10"
    }
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4 sm:p-4 pb-20">
      <SEOHead
        title="Customer Management | Admin"
        description="Manage your customers and CRM"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-bold">Customer Management</h1>
            {tenant && (
              <TooltipGuide
                title="Customer Management"
                content="Import customers from your existing spreadsheet. Add contact info, preferences, and track purchase history."
                placement="right"
                tenantId={tenant.id}
                tenantCreatedAt={(tenant.created_at as string) || new Date().toISOString()}
              />
            )}
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">Complete CRM for your customers</p>
        </div>
      </div>

      {/* Stats Carousel */}
      <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-4 snap-x snap-mandatory hide-scrollbar">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="min-w-[240px] sm:min-w-0 snap-center"
          >
            <Card className="border-none shadow-sm bg-gradient-to-br from-card to-muted/20 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={cn("p-2 rounded-full", stat.bg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Table Toolbar & Data */}
      <div className="space-y-4">
        <AdminToolbar
          searchQuery={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search customers..."
          filters={
            <>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="recreational">Recreational</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <CustomerTagFilter
                selectedTagIds={filterTagIds}
                onTagsChange={setFilterTagIds}
              />
            </>
          }
          actions={
            <>
              {canEdit('customers') && (
                <Button onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/customers/new`)} className="h-9 min-w-[100px] sm:min-w-0">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Customer</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              )}
              {canExport('customers') && (
                <Button variant="outline" size="sm" onClick={handleExport} className="h-9 min-w-[100px] sm:min-w-0">
                  <Download className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              )}
              {canEdit('customers') && (
                <Button variant="outline" size="sm" className="h-9 min-w-[100px] sm:min-w-0" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })} className="h-9 min-w-[100px] sm:min-w-0">
                <Filter className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </>
          }
        />

        <AdminDataTable
          data={displayedCustomers}
          columns={customerColumns}
          keyExtractor={(c) => c.id}
          isLoading={loading}
          renderMobileItem={renderMobileItem}
          emptyStateIcon={Users}
          emptyStateTitle={debouncedSearchTerm ? "No customers found" : "No customers yet"}
          emptyStateDescription={debouncedSearchTerm ? "No customers match your search." : "Customers are automatically added when they place orders"}
          emptyStateAction={
            debouncedSearchTerm ? {
              label: "Clear Search",
              onClick: () => setSearchTerm('')
            } : {
              label: "Import Customers",
              onClick: () => setImportDialogOpen(true),
            }
          }
        />

        {totalCount > 0 && (
          <StandardPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalCount}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
          />
        )}
      </div>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        itemName={customerToDelete?.name}
        itemType="customer"
        isLoading={isDeleting}
      />

      {/* Mobile Customer Details Drawer */}
      <Drawer open={!!selectedCustomerForDrawer} onOpenChange={(open) => !open && setSelectedCustomerForDrawer(null)}>
        <DrawerContent>
          {selectedCustomerForDrawer && (
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {selectedCustomerForDrawer.first_name?.[0]}{selectedCustomerForDrawer.last_name?.[0]}
                  </div>
                  <div className="text-left">
                    <div>{selectedCustomerForDrawer.first_name} {selectedCustomerForDrawer.last_name}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {selectedCustomerForDrawer._encryptedIndicator ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Lock className="w-3 h-3" />
                          <span className="italic">Contact encrypted</span>
                        </span>
                      ) : (
                        selectedCustomerForDrawer.email || selectedCustomerForDrawer.phone || 'No contact'
                      )}
                    </div>
                  </div>
                </DrawerTitle>
                <DrawerDescription>
                  Customer since {new Date().getFullYear()}
                </DrawerDescription>
              </DrawerHeader>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-3 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Spent</div>
                    <div className="text-xl font-bold">{formatCurrency(selectedCustomerForDrawer.total_spent)}</div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Points</div>
                    <div className="text-xl font-bold flex items-center justify-center gap-1">
                      <Award className="w-4 h-4 text-yellow-600" />
                      {selectedCustomerForDrawer.loyalty_points ?? 0}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedCustomerForDrawer._encryptedIndicator ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Contact information is encrypted. Sign in with your encryption key to view.
                      </p>
                    </div>
                  ) : (
                    <>
                      <Button className="w-full justify-start" variant="outline" onClick={() => {
                        if (selectedCustomerForDrawer.phone) window.location.href = `tel:${selectedCustomerForDrawer.phone}`;
                      }} disabled={!selectedCustomerForDrawer.phone}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call {selectedCustomerForDrawer.phone || 'No Phone'}
                      </Button>
                      <Button className="w-full justify-start" variant="outline" onClick={() => {
                        if (selectedCustomerForDrawer.email) window.location.href = `mailto:${selectedCustomerForDrawer.email}`;
                      }} disabled={!selectedCustomerForDrawer.email}>
                        <Mail className="w-4 h-4 mr-2" />
                        Email {selectedCustomerForDrawer.email || 'No Email'}
                      </Button>
                    </>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="w-full">
                          <Button
                            className="w-full mb-2"
                            disabled={!posEnabled}
                            onClick={() => posEnabled && tenant?.slug && navigate(`/${tenant.slug}/admin/pos?customer=${selectedCustomerForDrawer.id}`)}
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Create New Order
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!posEnabled && (
                        <TooltipContent>Enable POS in Settings</TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/customers/${selectedCustomerForDrawer.id}`)}>
                      View Profile
                    </Button>
                    <Button variant="secondary" onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/customer-management/${selectedCustomerForDrawer.id}/edit`)}>
                      Edit Details
                    </Button>
                  </div>
                </div>
              </div>
              <DrawerFooter>
                <Button variant="ghost" onClick={() => setSelectedCustomerForDrawer(null)}>Close</Button>
              </DrawerFooter>
            </div>
          )}
        </DrawerContent>
      </Drawer>
      <CustomerImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })}
      />
    </div>
  );
}
