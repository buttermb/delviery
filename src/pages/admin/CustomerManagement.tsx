import { logger } from '@/lib/logger';
import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useDebounce } from "@/hooks/useDebounce";
import { queryKeys } from "@/lib/queryKeys";
import { invalidateOnEvent } from "@/lib/invalidation";
import { formatCurrency, formatSmartDate, displayName } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Users, Plus, Search, DollarSign, Award, TrendingUp, UserCircle,
  MoreHorizontal, Edit, Trash, Eye, Filter, Download, Upload, Mail, Lock, Phone,
  ArrowUpDown, Store, Monitor, Globe
} from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { TooltipGuide } from "@/components/shared/TooltipGuide";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTenantFeatureToggles } from "@/hooks/useTenantFeatureToggles";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { usePagination } from "@/hooks/usePagination";
import { StandardPagination } from "@/components/shared/StandardPagination";
import { useEncryption } from "@/lib/hooks/useEncryption";
import { motion, AnimatePresence } from "framer-motion";
import { SwipeableItem } from "@/components/mobile/SwipeableItem";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { triggerHaptic } from "@/lib/utils/mobile";
import { cn } from "@/lib/utils";
import { CustomerImportDialog } from "@/components/admin/CustomerImportDialog";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import CopyButton from "@/components/CopyButton";
import { CustomerTagFilter } from "@/components/admin/customers/CustomerTagFilter";
import { CustomerTagBadges } from "@/components/admin/customers/CustomerTagBadges";
import { TruncatedText } from "@/components/shared/TruncatedText";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  referral_source: string | null;
  /** Indicates data is encrypted but cannot be decrypted with current key */
  _encryptedIndicator?: boolean;
}

type SortField = 'name' | 'total_spent' | 'last_purchase_at' | 'created_at';
type SortDirection = 'asc' | 'desc';

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
  const { navigateToAdmin } = useTenantNavigation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const { decryptObject, isReady: encryptionIsReady } = useEncryption();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<Customer | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const { isEnabled: isFeatureEnabled } = useTenantFeatureToggles();
  const { canEdit, canDelete, canExport } = usePermissions();
  const posEnabled = isFeatureEnabled('pos');

  // Get customer IDs filtered by tags
  const { data: customerIdsByTags } = useCustomersByTags(filterTagIds);

  const { data: customers = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.customers.list(tenant?.id, { filterType, filterStatus, filterSource }),
    queryFn: async () => {
      if (!tenant) return [];

      let query = supabase
        .from("customers")
        .select("id, tenant_id, first_name, last_name, email, phone, customer_type, total_spent, loyalty_points, loyalty_tier, last_purchase_at, status, medical_card_expiration, phone_encrypted, email_encrypted, deleted_at, created_at, referral_source")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null); // Exclude soft-deleted customers

      if (filterType !== "all") {
        query = query.eq("customer_type", filterType);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (filterSource === "storefront") {
        query = query.eq("referral_source", "storefront");
      } else if (filterSource === "pos") {
        query = query.eq("referral_source", "pos");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

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

      return decryptedCustomers as unknown as Customer[];
    },
    enabled: !!tenant && !accountLoading,
  });

  const handleDeleteClick = (customerId: string, customerName: string) => {
    triggerHaptic('medium');
    setCustomerToDelete({ id: customerId, name: customerName });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete || !tenant) return;

    // Snapshot current cache and optimistically remove customer
    const queryKey = queryKeys.customers.list(tenant.id, { filterType, filterStatus });
    const previousCustomers = queryClient.getQueryData<Customer[]>(queryKey);
    queryClient.setQueryData<Customer[]>(queryKey, (old) =>
      old?.filter((c) => c.id !== customerToDelete.id)
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
      if (previousCustomers) {
        queryClient.setQueryData(queryKey, previousCustomers);
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
      ["Name", "Email", "Phone", "Type", "Source", "Total Spent", "Loyalty Points", "Status"],
      ...filteredCustomers.map(c => [
        displayName(c.first_name, c.last_name),
        c.email ?? '',
        c.phone ?? '',
        c.customer_type,
        c.referral_source ?? 'direct',
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

  const filteredCustomers = useMemo(() => {
    const filtered = customers.filter((customer) => {
      const fullName = displayName(customer.first_name, customer.last_name).toLowerCase();
      const search = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        fullName.includes(search) ||
        customer.email?.toLowerCase().includes(search) ||
        customer.phone?.includes(search);

      // Filter by tags if any are selected
      const matchesTags =
        filterTagIds.length === 0 ||
        (customerIdsByTags && customerIdsByTags.includes(customer.id));

      return matchesSearch && matchesTags;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'name': {
          const nameA = displayName(a.first_name, a.last_name).toLowerCase();
          const nameB = displayName(b.first_name, b.last_name).toLowerCase();
          return dir * nameA.localeCompare(nameB);
        }
        case 'total_spent':
          return dir * ((a.total_spent ?? 0) - (b.total_spent ?? 0));
        case 'last_purchase_at': {
          const dateA = a.last_purchase_at ? new Date(a.last_purchase_at).getTime() : 0;
          const dateB = b.last_purchase_at ? new Date(b.last_purchase_at).getTime() : 0;
          return dir * (dateA - dateB);
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [customers, debouncedSearchTerm, filterTagIds, customerIdsByTags, sortField, sortDirection]);

  // Use standardized pagination
  const {
    paginatedItems: paginatedCustomers,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(filteredCustomers, {
    defaultPageSize: 25,
    persistInUrl: true,
    urlKey: 'customers',
  });

  // Calculate stats
  const { totalCustomers, activeCustomers, medicalPatients, totalRevenue, avgLifetimeValue } = useMemo(() => {
    const total = customers.length;
    const active = customers.filter(c => c.status === 'active').length;
    const medical = customers.filter(c => c.customer_type === 'medical').length;
    const revenue = customers.reduce((sum, c) => sum + (c.total_spent ?? 0), 0);
    const avgLTV = total > 0 ? revenue / total : 0;
    return { totalCustomers: total, activeCustomers: active, medicalPatients: medical, totalRevenue: revenue, avgLifetimeValue: avgLTV };
  }, [customers]);

  const getCustomerStatus = (customer: Customer) => {
    if (!customer.last_purchase_at) return <Badge variant="outline">New</Badge>;

    const daysSince = Math.floor(
      (Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince > 60) return <Badge variant="destructive">At Risk</Badge>;
    if (daysSince <= 7) return <Badge className="bg-green-600">Active</Badge>;
    return <Badge variant="secondary">Regular</Badge>;
  };

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
                  {["", "Customer", "Type", "Source", "Total Spent", "Points", "Last Order", "Tags", "Status", "Actions"].map((h, i) => (
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
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
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

  const atRiskCount = useMemo(() => customers.filter(c => {
    if (!c.last_purchase_at) return false;
    const days = Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
    return days > 60;
  }).length, [customers]);

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
        {canEdit('customers') && (
          <Button
            onClick={() => navigate(`/${tenantSlug}/admin/customers/new`)}
            className="min-h-[44px] touch-manipulation flex-shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Customer</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
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

      {/* Search and Filters */}
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search customers"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="storefront">Storefront</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="recreational">Recreational</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={`${sortField}-${sortDirection}`} onValueChange={(v) => {
                const [field, dir] = v.split('-') as [SortField, SortDirection];
                setSortField(field);
                setSortDirection(dir);
              }}>
                <SelectTrigger className="w-[160px]">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at-desc">Newest First</SelectItem>
                  <SelectItem value="created_at-asc">Oldest First</SelectItem>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="total_spent-desc">Highest Spent</SelectItem>
                  <SelectItem value="total_spent-asc">Lowest Spent</SelectItem>
                  <SelectItem value="last_purchase_at-desc">Recent Orders</SelectItem>
                  <SelectItem value="last_purchase_at-asc">Oldest Orders</SelectItem>
                </SelectContent>
              </Select>
              <CustomerTagFilter
                selectedTagIds={filterTagIds}
                onTagsChange={setFilterTagIds}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canExport('customers') && (
              <Button variant="outline" size="sm" onClick={handleExport} className="min-h-[44px] flex-1 sm:flex-initial min-w-[100px]">
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Export</span>
                <span className="sm:hidden">Export</span>
              </Button>
            )}
            {canEdit('customers') && (
              <Button variant="outline" size="sm" className="min-h-[44px] flex-1 sm:flex-initial min-w-[100px]" onClick={() => setImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Import</span>
                <span className="sm:hidden">Import</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })} className="min-h-[44px] flex-1 sm:flex-initial min-w-[100px]">
              <Filter className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Refresh</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table (Desktop) */}
      <Card className="hidden md:block border-none shadow-md">
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      className="rounded"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCustomers(paginatedCustomers.map(c => c.id));
                        } else {
                          setSelectedCustomers([]);
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Last Order</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCustomers([...selectedCustomers, customer.id]);
                          } else {
                            setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'}>
                        {customer.customer_type === 'medical' ? 'Medical' : 'Recreational'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {customer.referral_source === 'storefront' ? (
                        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300">
                          <Globe className="w-3 h-3 mr-1" />
                          Storefront
                        </Badge>
                      ) : customer.referral_source === 'pos' ? (
                        <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300">
                          <Monitor className="w-3 h-3 mr-1" />
                          POS
                        </Badge>
                      ) : (
                        <Badge variant="outline">Direct</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-semibold">
                      {formatCurrency(customer.total_spent)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4 text-yellow-600" />
                        {customer.loyalty_points ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.last_purchase_at
                        ? formatSmartDate(customer.last_purchase_at)
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <CustomerTagBadges customerId={customer.id} maxVisible={2} />
                    </TableCell>
                    <TableCell>
                      {getCustomerStatus(customer)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" aria-label="Customer actions">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredCustomers.length === 0 && (
              <EnhancedEmptyState
                icon={Users}
                title={debouncedSearchTerm ? "No customers found" : "No customers yet"}
                description={debouncedSearchTerm ? "No customers match your search." : "Customers are automatically added when they place orders"}
                primaryAction={debouncedSearchTerm ? {
                  label: "Clear Search",
                  onClick: () => setSearchTerm('')
                } : undefined}
                secondaryAction={!debouncedSearchTerm ? {
                  label: "Import Customers",
                  onClick: () => setImportDialogOpen(true),
                } : undefined}
                designSystem="tenant-admin"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Swipeable List View */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <EnhancedEmptyState
            icon={Users}
            title={debouncedSearchTerm ? "No customers found" : "No customers yet"}
            description={debouncedSearchTerm ? "No customers match your search." : "Customers are automatically added when they place orders"}
            primaryAction={debouncedSearchTerm ? {
              label: "Clear Search",
              onClick: () => setSearchTerm('')
            } : undefined}
            secondaryAction={!debouncedSearchTerm ? {
              label: "Import Customers",
              onClick: () => setImportDialogOpen(true),
            } : undefined}
            designSystem="tenant-admin"
          />
        ) : (
          <AnimatePresence>
            {paginatedCustomers.map((customer) => (
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
                          {customer.referral_source === 'storefront' ? (
                            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 text-[10px] h-5 px-1.5">
                              <Globe className="w-2.5 h-2.5 mr-0.5" />
                              Storefront
                            </Badge>
                          ) : customer.referral_source === 'pos' ? (
                            <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 text-[10px] h-5 px-1.5">
                              POS
                            </Badge>
                          ) : null}
                          {getCustomerStatus(customer)}
                          <CustomerTagBadges customerId={customer.id} maxVisible={2} size="sm" />
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
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Pagination */}
      {filteredCustomers.length > 0 && (
        <StandardPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          pageSizeOptions={pageSizeOptions}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      )}

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
