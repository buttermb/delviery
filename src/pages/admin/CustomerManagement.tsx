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
  MoreHorizontal, Edit, Trash, Eye, Filter, Download, Upload, Phone, Mail, Calendar
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
}

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
        .select("*")
        .eq("tenant_id", tenant.id);

      if (filterType !== "all") {
        query = query.eq("customer_type", filterType);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Decrypt customer data if encryption is ready and encrypted fields exist
      let decryptedCustomers = data || [];
      if (encryptionIsReady && data && data.length > 0 && (data[0].phone_encrypted || data[0].email_encrypted)) {
        try {
          decryptedCustomers = data.map((customer: any) => {
            try {
              const decrypted = decryptObject(customer);
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
              // Fall back to plaintext if decryption fails
              logger.warn('Failed to decrypt customer, using plaintext', decryptError instanceof Error ? decryptError : new Error(String(decryptError)), { component: 'CustomerManagement' });
              return customer;
            }
          });
        } catch (error) {
          logger.warn('Failed to decrypt customers, using plaintext', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerManagement' });
          decryptedCustomers = data || [];
        }
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
    if (!customerToDelete) return;

    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerToDelete.id);

      if (error) throw error;

      triggerHaptic('light');
      toast.success("Customer deleted successfully");
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
    const fullName = `${customer.first_name} ${customer.last_name}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    return (
      fullName.includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.phone?.includes(search)
    );
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
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
                          <div className="text-sm text-muted-foreground">{customer.email || customer.phone}</div>
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
                          <DropdownMenuItem onClick={() => navigate(`/admin/customers/${customer.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/admin/customer-management/${customer.id}/edit`)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/admin/pos?customer=${customer.id}`)}>
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
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "No customers found matching your search" : "No customers yet"}
                </p>
                <Button onClick={() => navigateToAdmin('customers/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Customer
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mobile Swipeable List View */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No customers found matching your search" : "No customers yet"}
            </p>
            <Button onClick={() => navigateToAdmin('customers/new')} className="min-h-[48px]">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Customer
            </Button>
          </div>
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
                  onClick: () => navigate(`/admin/customers/${customer.id}`)
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
                        <p className="text-sm text-muted-foreground truncate">{customer.email || customer.phone}</p>
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
                    <div className="text-sm font-normal text-muted-foreground">{selectedCustomerForDrawer.email || selectedCustomerForDrawer.phone}</div>
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
                  <Button className="w-full justify-start" variant="outline" onClick={() => {
                    if (selectedCustomerForDrawer.phone) window.location.href = `tel:${selectedCustomerForDrawer.phone}`;
                  }}>
                    <Phone className="w-4 h-4 mr-2" />
                    Call {selectedCustomerForDrawer.phone || 'No Phone'}
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => {
                    if (selectedCustomerForDrawer.email) window.location.href = `mailto:${selectedCustomerForDrawer.email}`;
                  }}>
                    <Mail className="w-4 h-4 mr-2" />
                    Email {selectedCustomerForDrawer.email || 'No Email'}
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <Button className="w-full mb-2" onClick={() => navigate(`/admin/pos?customer=${selectedCustomerForDrawer.id}`)}>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Create New Order
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={() => navigate(`/admin/customers/${selectedCustomerForDrawer.id}`)}>
                      View Profile
                    </Button>
                    <Button variant="secondary" onClick={() => navigate(`/admin/customer-management/${selectedCustomerForDrawer.id}/edit`)}>
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
