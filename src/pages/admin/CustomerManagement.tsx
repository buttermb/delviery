import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
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
  MoreHorizontal, Edit, Trash, Eye, Filter, Download, Upload, Phone, Mail, Calendar, Lock,
  AlertTriangle, CheckCircle, UserPlus
} from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { TooltipGuide } from "@/components/shared/TooltipGuide";
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
import { VirtualList } from "@/components/ui/virtual-list";
import { useSwipeBack, useLongPress } from "@/hooks/useGestures";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import CopyButton from "@/components/CopyButton";

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

export default function CustomerManagement() {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, admin, loading: accountLoading } = useTenantAdminAuth();
  const { decryptObject, isReady: encryptionIsReady } = useEncryption();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCustomerForDrawer, setSelectedCustomerForDrawer] = useState<Customer | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'active' | 'at_risk' | 'new'>('all');

  useEffect(() => {
    if (tenant && !accountLoading) {
      loadCustomers();
    } else if (!accountLoading && !tenant) {
      setLoading(false);
    }
  }, [tenant, accountLoading, filterType, filterStatus]);

  const loadCustomers = async () => {
    if (!tenant) return;

    try {
      setLoading(true);
      let query = supabase
        .from("customers")
        .select("id, tenant_id, first_name, last_name, email, phone, customer_type, total_spent, loyalty_points, loyalty_tier, last_purchase_at, status, medical_card_expiration, phone_encrypted, email_encrypted, deleted_at, created_at")
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null); // Exclude soft-deleted customers

      if (filterType !== "all") {
        query = query.eq("customer_type", filterType);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Decrypt customer data if encryption is ready and encrypted fields exist
      let decryptedCustomers: any[] = data || [];
      if (encryptionIsReady && data && data.length > 0 && ((data[0] as any).phone_encrypted || (data[0] as any).email_encrypted)) {
        try {
          decryptedCustomers = data.map((customer: Record<string, unknown>) => {
            try {
              const decrypted = decryptObject(customer as Record<string, string>);
              // Map decrypted fields to Customer interface
              const nameParts = typeof decrypted.name === 'string' ? decrypted.name.split(' ') : ['', ''];
              return {
                ...customer,
                first_name: nameParts[0] || customer.first_name || '',
                last_name: nameParts.slice(1).join(' ') || customer.last_name || '',
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
        } catch (error) {
          logger.warn('Failed to decrypt customers, using plaintext', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerManagement' });
          decryptedCustomers = data || [];
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

      setCustomers(decryptedCustomers);
      if (decryptedCustomers.length > 0) {
        // toast.success("Customers loaded"); // Reduced noise
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load customers";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (customerId: string, customerName: string) => {
    triggerHaptic('medium');
    setCustomerToDelete({ id: customerId, name: customerName });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete || !tenant) return;

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

      loadCustomers(); // Refresh the list
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      setSelectedCustomerForDrawer(null); // Close drawer if open
    } catch (error: unknown) {
      logger.error("Failed to delete customer", error, { component: "CustomerManagement" });
      toast.error("Failed to delete customer", {
        description: error instanceof Error ? error.message : "An error occurred"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Name", "Email", "Phone", "Type", "Total Spent", "Loyalty Points", "Status"],
      ...filteredCustomers.map(c => [
        `${c.first_name} ${c.last_name}`,
        c.email || '',
        c.phone || '',
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

  const filteredCustomers = customers.filter((customer) => {
    // Search filter
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      fullName.includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.phone?.includes(search)
    );

    // Segment filter
    let matchesSegment = true;
    if (segmentFilter === 'active') {
      if (!customer.last_purchase_at) {
        matchesSegment = false;
      } else {
        const days = Math.floor((Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
        matchesSegment = days <= 7;
      }
    } else if (segmentFilter === 'at_risk') {
      if (!customer.last_purchase_at) {
        matchesSegment = false;
      } else {
        const days = Math.floor((Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
        matchesSegment = days > 60;
      }
    } else if (segmentFilter === 'new') {
      matchesSegment = !customer.last_purchase_at;
    }

    return matchesSearch && matchesSegment;
  });

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
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const medicalPatients = customers.filter(c => c.customer_type === 'medical').length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  const avgLifetimeValue = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

  // Segment counts
  const atRiskCustomers = customers.filter(c => {
    if (!c.last_purchase_at) return false;
    const days = Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
    return days > 60;
  });
  const newCustomers = customers.filter(c => !c.last_purchase_at);
  const recentlyActive = customers.filter(c => {
    if (!c.last_purchase_at) return false;
    const days = Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
    return days <= 7;
  });

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
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
        <div className="h-10 w-64 skeleton-shimmer rounded-lg" />
        <div className="h-12 w-full skeleton-shimmer rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 skeleton-shimmer rounded-lg animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 75}ms`, animationFillMode: 'backwards' }}
            />
          ))}
        </div>
      </div>
    );
  }

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
      value: `$${totalRevenue.toLocaleString()}`,
      sub: "Lifetime",
      icon: DollarSign,
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    {
      title: "Avg LTV",
      value: `$${avgLifetimeValue.toFixed(0)}`,
      sub: "Per customer",
      icon: TrendingUp,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      title: "At Risk",
      value: customers.filter(c => {
        if (!c.last_purchase_at) return false;
        const days = Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
        return days > 60;
      }).length,
      sub: "60+ days inactive",
      icon: Award,
      color: "text-red-500",
      bg: "bg-red-500/10"
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-20">
      <SEOHead
        title="Customer Management | Admin"
        description="Manage your customers and CRM"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Customer Management</h1>
            {tenant && (
              <TooltipGuide
                title="💡 Customer Management"
                content="Import customers from your existing spreadsheet. Add contact info, preferences, and track purchase history."
                placement="right"
                tenantId={tenant.id}
                tenantCreatedAt={(tenant.created_at as string) || new Date().toISOString()}
              />
            )}
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">Complete CRM for your customers</p>
        </div>
        <Button
          onClick={() => navigate(`/${tenantSlug}/admin/customers/new`)}
          className="min-h-[44px] touch-manipulation flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Add Customer</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Compact Stats Bar */}
      <div className="flex items-center gap-4 sm:gap-6 py-2.5 px-4 bg-muted/30 rounded-lg overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-bold tabular-nums">{totalCustomers}</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <UserCircle className="h-4 w-4 text-purple-500" />
          <span className="text-sm text-muted-foreground">Medical</span>
          <span className="font-bold tabular-nums">{medicalPatients}</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          <span className="text-sm text-muted-foreground">Revenue</span>
          <span className="font-bold tabular-nums">${(totalRevenue / 1000).toFixed(1)}k</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <TrendingUp className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-muted-foreground">Avg LTV</span>
          <span className="font-bold tabular-nums">${avgLifetimeValue.toFixed(0)}</span>
        </div>
      </div>

      {/* Segment Quick Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <Button
          variant={segmentFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSegmentFilter('all')}
          className="min-h-[36px] whitespace-nowrap"
        >
          <Users className="h-3.5 w-3.5 mr-1.5" />
          All ({totalCustomers})
        </Button>
        <Button
          variant={segmentFilter === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSegmentFilter('active')}
          className="min-h-[36px] whitespace-nowrap"
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-500" />
          Active ({recentlyActive.length})
        </Button>
        <Button
          variant={segmentFilter === 'at_risk' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSegmentFilter('at_risk')}
          className={cn("min-h-[36px] whitespace-nowrap", atRiskCustomers.length > 0 && segmentFilter !== 'at_risk' && "border-red-200 text-red-600")}
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-red-500" />
          At Risk ({atRiskCustomers.length})
        </Button>
        <Button
          variant={segmentFilter === 'new' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSegmentFilter('new')}
          className="min-h-[36px] whitespace-nowrap"
        >
          <UserPlus className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
          New ({newCustomers.length})
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
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
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="min-h-[44px] flex-1 sm:flex-initial min-w-[100px]">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="min-h-[44px] flex-1 sm:flex-initial min-w-[100px]" onClick={() => setImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Import</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button variant="outline" size="sm" onClick={loadCustomers} className="min-h-[44px] flex-1 sm:flex-initial min-w-[100px]">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-background divide-y divide-border">
                {paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                          {customer.first_name?.[0]}{customer.last_name?.[0]}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium">
                            {customer.first_name} {customer.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            {customer._encryptedIndicator ? (
                              <span className="flex items-center gap-1 text-amber-600" title="Contact info encrypted - sign in to view">
                                <Lock className="w-3 h-3" />
                                <span className="italic">Encrypted</span>
                              </span>
                            ) : (
                              <>
                                {customer.email || customer.phone || 'No contact'}
                                {customer.email && (
                                  <CopyButton text={customer.email} label="Email" showLabel={false} size="icon" variant="ghost" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'}>
                        {customer.customer_type === 'medical' ? '🏥 Medical' : 'Recreational'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      ${customer.total_spent?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Award className="w-4 h-4 text-yellow-600" />
                        {customer.loyalty_points || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {customer.last_purchase_at
                        ? new Date(customer.last_purchase_at).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      {getCustomerStatus(customer)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/customers/${customer.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/customer-management/${customer.id}/edit`)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/pos?customer=${customer.id}`)}>
                            <DollarSign className="w-4 h-4 mr-2" />
                            New Order
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteClick(customer.id, `${customer.first_name} ${customer.last_name}`)}
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCustomers.length === 0 && (
              <EnhancedEmptyState
                icon={segmentFilter === 'at_risk' ? CheckCircle : segmentFilter === 'active' ? Users : Users}
                title={
                  segmentFilter === 'at_risk'
                    ? "No at-risk customers!"
                    : segmentFilter === 'active'
                      ? "No recently active customers"
                      : segmentFilter === 'new'
                        ? "No new customers"
                        : searchTerm
                          ? `No results for "${searchTerm}"`
                          : "No Customers Yet"
                }
                description={
                  segmentFilter === 'at_risk'
                    ? "Great news! All your customers have been active recently."
                    : segmentFilter === 'active'
                      ? "No customers have made purchases in the last 7 days."
                      : segmentFilter === 'new'
                        ? "All customers have made at least one purchase."
                        : searchTerm
                          ? "Try adjusting your search terms."
                          : "Add your first customer to get started."
                }
                primaryAction={searchTerm || segmentFilter !== 'all' ? {
                  label: "Clear Filters",
                  onClick: () => { setSearchTerm(''); setSegmentFilter('all'); }
                } : {
                  label: "Add Your First Customer",
                  onClick: () => navigateToAdmin('customers/new'),
                  icon: Plus
                }}
                className={segmentFilter === 'at_risk' ? "bg-gradient-to-br from-emerald-500/5 to-transparent" : undefined}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Swipeable List View */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <EnhancedEmptyState
            icon={segmentFilter === 'at_risk' ? CheckCircle : Users}
            title={
              segmentFilter === 'at_risk'
                ? "No at-risk customers!"
                : segmentFilter === 'active'
                  ? "No recently active"
                  : searchTerm
                    ? `No results for "${searchTerm}"`
                    : "No Customers Yet"
            }
            description={
              segmentFilter === 'at_risk'
                ? "All customers have been active recently."
                : searchTerm
                  ? "Try adjusting your search."
                  : "Add your first customer to get started."
            }
            primaryAction={searchTerm || segmentFilter !== 'all' ? {
              label: "Clear Filters",
              onClick: () => { setSearchTerm(''); setSegmentFilter('all'); }
            } : {
              label: "Add Customer",
              onClick: () => navigateToAdmin('customers/new'),
              icon: Plus
            }}
            className={segmentFilter === 'at_risk' ? "bg-gradient-to-br from-emerald-500/5 to-transparent" : undefined}
          />
        ) : (
          <AnimatePresence>
            {filteredCustomers.map((customer) => (
              <SwipeableItem
                key={customer.id}
                leftAction={{
                  icon: <Trash className="h-5 w-5" />,
                  color: 'bg-red-500',
                  label: 'Delete',
                  onClick: () => handleDeleteClick(customer.id, `${customer.first_name} ${customer.last_name}`)
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
                        <h3 className="font-semibold text-base truncate">
                          {customer.first_name} {customer.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {customer._encryptedIndicator ? (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Lock className="w-3 h-3" />
                              <span className="italic">Encrypted</span>
                            </span>
                          ) : (
                            customer.email || customer.phone || 'No contact'
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                            {customer.customer_type === 'medical' ? 'Medical' : 'Rec'}
                          </Badge>
                          {getCustomerStatus(customer)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-bold">${customer.total_spent?.toFixed(0) || '0'}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Award className="w-3 h-3 text-yellow-600" />
                        {customer.loyalty_points || 0}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-3 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Spent</div>
                    <div className="text-xl font-bold">${selectedCustomerForDrawer.total_spent?.toFixed(2) || '0.00'}</div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Points</div>
                    <div className="text-xl font-bold flex items-center justify-center gap-1">
                      <Award className="w-4 h-4 text-yellow-600" />
                      {selectedCustomerForDrawer.loyalty_points || 0}
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
                  <Button className="w-full mb-2" onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/pos?customer=${selectedCustomerForDrawer.id}`)}>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Create New Order
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
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
        onSuccess={loadCustomers}
      />
    </div>
  );
}
