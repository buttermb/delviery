import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useEncryption } from "@/lib/hooks/useEncryption";
import { decryptCustomerData } from '@/lib/utils/customerEncryption';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  TrendingUp,
  DollarSign,
  Tag,
  Plus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerSegmentation } from "@/components/admin/crm/CustomerSegmentation";
import { RFMAnalysis } from "@/components/admin/crm/RFMAnalysis";
import { CommunicationTimeline } from "@/components/admin/crm/CommunicationTimeline";
import { queryKeys } from "@/lib/queryKeys";
import { useCRMDashboard } from "@/hooks/crm/useCRMDashboard";
import { ActivityTimeline } from "@/components/crm/ActivityTimeline";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate, displayName } from '@/lib/formatters';
import type { CRMActivityLog } from '@/types/crm';
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar';
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  total_spent: number;
  loyalty_points: number;
  last_purchase_at: string | null;
  created_at: string;
  status: string;
}

interface EnrichedCustomer extends Customer {
  lifecycle: string;
  rfm: { r: number; f: number; m: number; rfm: string };
  segment: string;
}

export default function CustomerCRMPage() {
  const { tenant } = useTenantAdminAuth();
  const { isReady: encryptionIsReady } = useEncryption();
  const { navigateToAdmin } = useTenantNavigation();
  const [searchTerm, setSearchTerm] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: dashboardMetrics } = useCRMDashboard();

  const { data: customers, isLoading } = useQuery({
    queryKey: queryKeys.customers.list(tenant?.id, { lifecycle: lifecycleFilter, segment: segmentFilter }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("customers")
          .select('id, first_name, last_name, email, phone, total_spent, loyalty_points, last_purchase_at, created_at, status, is_encrypted')
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });

        if (error) {
          logger.error('Failed to fetch customers', error, { component: 'CustomerCRMPage' });
          return [];
        }

        // Decrypt encrypted customers if encryption is ready
        if (encryptionIsReady && data) {
          const decrypted = await Promise.all(
            data.map(async (c) => {
              if (c.is_encrypted) {
                try {
                  return await decryptCustomerData(c);
                } catch (err) {
                  logger.error('Failed to decrypt customer', err as Error, {
                    component: 'CustomerCRMPage',
                    customerId: c.id
                  });
                  return c; // Return plaintext fallback
                }
              }
              return c;
            })
          );
          return decrypted as unknown as Customer[];
        }

        return (data ?? []) as Customer[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id && encryptionIsReady,
  });

  // Calculate lifecycle stage for each customer
  const getLifecycleStage = (customer: Customer): string => {
    if (!customer.last_purchase_at) return "prospect";

    const daysSince = Math.floor(
      (Date.now() - new Date(customer.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince > 90) return "churned";
    if (daysSince > 60) return "at-risk";
    if (daysSince <= 30) return "active";
    return "regular";
  };

  // Calculate RFM scores
  const calculateRFM = (customer: Customer) => {
    const now = Date.now();
    const lastPurchase = customer.last_purchase_at
      ? new Date(customer.last_purchase_at).getTime()
      : 0;

    const recency = lastPurchase
      ? Math.floor((now - lastPurchase) / (1000 * 60 * 60 * 24))
      : 999;

    // Frequency would need order count - simplified for now
    const frequency = 1; // Placeholder

    const monetary = customer.total_spent ?? 0;

    // Score from 1-5 (5 is best)
    const rScore = recency <= 30 ? 5 : recency <= 60 ? 4 : recency <= 90 ? 3 : recency <= 180 ? 2 : 1;
    const fScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 1 ? 2 : 1;
    const mScore = monetary >= 1000 ? 5 : monetary >= 500 ? 4 : monetary >= 200 ? 3 : monetary >= 50 ? 2 : 1;

    return { r: rScore, f: fScore, m: mScore, rfm: `${rScore}${fScore}${mScore}` };
  };

  // Auto-segment customers
  const getSegment = (customer: Customer): string => {
    const rfm = calculateRFM(customer);
    const lifecycle = getLifecycleStage(customer);

    if (rfm.rfm === "555" || rfm.rfm === "554" || rfm.rfm === "545") return "champions";
    if (rfm.m === 5 && rfm.r >= 3) return "high-value";
    if (lifecycle === "at-risk" && rfm.m >= 3) return "at-risk";
    if (customer.total_spent >= 500) return "bulk-buyers";
    if (lifecycle === "prospect") return "new";
    return "regular";
  };

  const formatTotalSpent = (value: number | null | undefined): string =>
    Number(value ?? 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const filteredCustomers = customers?.map((customer) => ({
    ...customer,
    lifecycle: getLifecycleStage(customer),
    rfm: calculateRFM(customer),
    segment: getSegment(customer),
  })).filter((customer) => {
    const matchesSearch =
      displayName(customer.first_name, customer.last_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLifecycle = lifecycleFilter === "all" || customer.lifecycle === lifecycleFilter;
    const matchesSegment = segmentFilter === "all" || customer.segment === segmentFilter;

    return matchesSearch && matchesLifecycle && matchesSegment;
  }) ?? [];

  const crmColumns = [
    {
      header: 'Customer',
      cell: (customer: EnrichedCustomer) => (
        <div className="font-medium">
          {displayName(customer.first_name, customer.last_name)}
          {customer.email && (
            <div className="text-xs text-muted-foreground">
              {customer.email}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Lifecycle',
      accessorKey: 'lifecycle',
      cell: (customer: EnrichedCustomer) => (
        <Badge
          variant={
            customer.lifecycle === "active"
              ? "default"
              : customer.lifecycle === "at-risk"
                ? "destructive"
                : "secondary"
          }
        >
          {customer.lifecycle}
        </Badge>
      )
    },
    {
      header: 'Segment',
      accessorKey: 'segment',
      cell: (customer: EnrichedCustomer) => <Badge variant="outline">{customer.segment}</Badge>
    },
    {
      header: 'RFM Score',
      cell: (customer: EnrichedCustomer) => (
        <code className="text-sm bg-muted px-2 py-1 rounded">
          {customer.rfm.rfm}
        </code>
      )
    },
    {
      header: 'Total Spent',
      accessorKey: 'total_spent',
      cell: (customer: EnrichedCustomer) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          {formatTotalSpent(customer.total_spent)}
        </div>
      )
    },
    {
      header: 'Last Purchase',
      accessorKey: 'last_purchase_at',
      cell: (customer: EnrichedCustomer) => customer.last_purchase_at
        ? formatSmartDate(customer.last_purchase_at)
        : "Never"
    }
  ];

  const renderMobileCRMItem = (customer: EnrichedCustomer) => (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">
            {displayName(customer.first_name, customer.last_name)}
          </h3>
          {customer.email && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {customer.email}
            </p>
          )}
        </div>
        <Badge
          variant={
            customer.lifecycle === "active"
              ? "default"
              : customer.lifecycle === "at-risk"
                ? "destructive"
                : "secondary"
          }
          className="ml-2 flex-shrink-0"
        >
          {customer.lifecycle}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Segment</p>
          <Badge variant="outline" className="text-xs">
            {customer.segment}
          </Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">RFM Score</p>
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {customer.rfm.rfm}
          </code>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">
              {formatTotalSpent(customer.total_spent)}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Last Purchase</p>
          <p className="text-sm font-medium">
            {customer.last_purchase_at
              ? formatSmartDate(customer.last_purchase_at)
              : "Never"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Advanced CRM & Customer Insights
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Customer lifecycle, RFM analysis, segmentation, and communication timeline
          </p>
        </div>
      </div>

      {/* Filters */}
      <AdminToolbar
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search customers..."
        filters={
          <>
            <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Lifecycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lifecycle Stages</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="at-risk">At Risk</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>

            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="champions">Champions</SelectItem>
                <SelectItem value="high-value">High Value</SelectItem>
                <SelectItem value="bulk-buyers">Bulk Buyers</SelectItem>
                <SelectItem value="at-risk">At Risk</SelectItem>
                <SelectItem value="new">New Customers</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="dashboard" className="min-h-[44px] touch-manipulation">
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="overview" className="min-h-[44px] touch-manipulation">
            Customers
          </TabsTrigger>
          <TabsTrigger value="segmentation" className="min-h-[44px] touch-manipulation">
            Segmentation
          </TabsTrigger>
          <TabsTrigger value="rfm" className="min-h-[44px] touch-manipulation">
            RFM Analysis
          </TabsTrigger>
          <TabsTrigger value="timeline" className="min-h-[44px] touch-manipulation">
            Communication
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardMetrics?.totalClients ?? 0}</div>
                <p className="text-xs text-muted-foreground">Active CRM clients</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Invoices</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardMetrics?.activeInvoicesValue ?? 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardMetrics?.activeInvoicesCount ?? 0} outstanding invoices
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Pre-Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardMetrics?.pendingPreOrdersValue ?? 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardMetrics?.pendingPreOrdersCount ?? 0} orders pending
                </p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-muted/50" onClick={() => navigateToAdmin("crm/invoices/new")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quick Action</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">Create Invoice</div>
                <p className="text-xs text-muted-foreground">Click to start</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest actions across your CRM</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityTimeline activities={(dashboardMetrics?.recentActivity ?? []) as unknown as CRMActivityLog[]} />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>Navigate to key areas</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="outline" className="justify-start" onClick={() => navigateToAdmin("crm/clients")}>
                  <Users className="mr-2 h-4 w-4" /> Manage Clients
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigateToAdmin("crm/invoices")}>
                  <DollarSign className="mr-2 h-4 w-4" /> View Invoices
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => navigateToAdmin("crm/pre-orders")}>
                  <TrendingUp className="mr-2 h-4 w-4" /> Manage Pre-Orders
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <AdminDataTable
            data={filteredCustomers}
            columns={crmColumns as any}
            keyExtractor={(customer: EnrichedCustomer) => customer.id as string}
            isLoading={isLoading}
            emptyStateIcon={Users}
            emptyStateTitle={searchTerm ? "No Customers Found" : "No Customers Yet"}
            emptyStateDescription={searchTerm
              ? "No customers match your current filters. Try adjusting your search or filter criteria."
              : "Customers will appear here once they start placing orders."}
            emptyStateAction={searchTerm
              ? { label: "Clear Search", onClick: () => setSearchTerm('') }
              : { label: "Add Your First Customer", onClick: () => navigateToAdmin('crm/clients/new'), icon: Plus }}
            renderMobileItem={(customer: EnrichedCustomer) => renderMobileCRMItem(customer)}
          />
        </TabsContent>

        <TabsContent value="segmentation" className="space-y-4">
          <CustomerSegmentation customers={filteredCustomers} />
        </TabsContent>

        <TabsContent value="rfm" className="space-y-4">
          <RFMAnalysis customers={filteredCustomers} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <CommunicationTimeline customers={filteredCustomers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

