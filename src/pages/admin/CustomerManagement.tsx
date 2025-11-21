import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
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
  MoreHorizontal, Edit, Trash, Eye, Filter, Download, Upload
} from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { TooltipGuide } from "@/components/shared/TooltipGuide";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { logger } from "@/lib/logger";
import { usePagination } from "@/hooks/usePagination";
import { StandardPagination } from "@/components/shared/StandardPagination";
import { useEncryption } from "@/lib/hooks/useEncryption";

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
              logger.warn('Failed to decrypt customer, using plaintext', decryptError instanceof Error ? decryptError : new Error(String(decryptError)), { component: 'CustomerManagement', customerId: customer.id });
              return customer;
            }
          });
        } catch (error) {
          logger.warn('Failed to decrypt customers, using plaintext', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerManagement' });
          decryptedCustomers = data || [];
        }
      }

      setCustomers(decryptedCustomers);
      toast.success("Customers loaded");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load customers";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (customerId: string, customerName: string) => {
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

      toast.success("Customer deleted successfully");
      loadCustomers(); // Refresh the list
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    } catch (error: unknown) {
      logger.error("Failed to delete customer", error, { component: "CustomerManagement", customerId: customerToDelete.id });
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
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
          onClick={() => navigate("/admin/customers/new")}
          className="min-h-[44px] touch-manipulation flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Add Customer</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">{activeCustomers} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Medical Patients</CardTitle>
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{medicalPatients}</div>
            <p className="text-xs text-muted-foreground">
              {totalCustomers > 0 ? Math.round((medicalPatients / totalCustomers) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg LTV</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgLifetimeValue.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground">Per customer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.filter(c => {
                if (!c.last_purchase_at) return false;
                const days = Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24));
                return days > 60;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">60+ days</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Customer Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="recreational">Recreational</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
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

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="min-h-[44px] flex-1 sm:flex-initial">
              <Download className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Export</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="min-h-[44px] flex-1 sm:flex-initial">
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Import</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button variant="outline" size="sm" onClick={loadCustomers} className="min-h-[44px] flex-1 sm:flex-initial">
              <Filter className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Refresh</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Table */}
      <Card>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                <Button onClick={() => navigate("/admin/customers/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Customer
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-4">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "No customers found matching your search" : "No customers yet"}
                </p>
                <Button onClick={() => navigate("/admin/customers/new")} className="min-h-[48px]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Customer
                </Button>
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <Card key={customer.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                          {customer.first_name?.[0]}{customer.last_name?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">
                            {customer.first_name} {customer.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">{customer.email || customer.phone}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="min-h-[48px] min-w-[48px]">
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
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</div>
                        <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'}>
                          {customer.customer_type === 'medical' ? '🏥 Medical' : 'Recreational'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Spent</div>
                          <div className="text-sm font-semibold">${customer.total_spent?.toFixed(2) || '0.00'}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Points</div>
                          <div className="flex items-center gap-1 text-sm">
                            <Award className="w-4 h-4 text-yellow-600" />
                            {customer.loyalty_points || 0}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Order</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.last_purchase_at
                            ? new Date(customer.last_purchase_at).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</div>
                        <div>{getCustomerStatus(customer)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
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
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        itemName={customerToDelete?.name}
        itemType="customer"
        isLoading={isDeleting}
      />
    </div>
  );
}
