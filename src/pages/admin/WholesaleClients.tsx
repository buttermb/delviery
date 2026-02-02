import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useEncryption } from "@/lib/hooks/useEncryption";
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
import Search from "lucide-react/dist/esm/icons/search";
import Plus from "lucide-react/dist/esm/icons/plus";
import Phone from "lucide-react/dist/esm/icons/phone";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Package from "lucide-react/dist/esm/icons/package";
import Star from "lucide-react/dist/esm/icons/star";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Edit2 from "lucide-react/dist/esm/icons/edit-2";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { CustomerRiskBadge } from "@/components/admin/CustomerRiskBadge";
import { ClientStatusBadge } from "@/components/admin/ClientStatusBadge";
import { CreateClientDialog } from "@/components/admin/CreateClientDialog";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
// SendSMS removed per plan - can be re-added if needed
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
import { Input as ShadcnInput } from "@/components/ui/input"; // Renamed to avoid conflict
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TakeTourButton } from "@/components/tutorial/TakeTourButton";
import { SendPortalLinkDialog } from "@/components/admin/wholesale/SendPortalLinkDialog";
import { customersTutorial } from "@/lib/tutorials/tutorialConfig";
import { Database } from "@/integrations/supabase/types";
import { CustomerQuickViewCard } from "@/components/tenant-admin/CustomerQuickViewCard";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";

type WholesaleClientRow = Database['public']['Tables']['wholesale_clients']['Row'];

interface WholesaleClient extends WholesaleClientRow {
  territory: string;
  monthly_volume_lbs: number;
  total_spent: number;
  risk_score?: number | null;
}

import { useTablePreferences } from "@/hooks/useTablePreferences";
import CopyButton from "@/components/CopyButton";
import { ExportButton } from "@/components/ui/ExportButton";
import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";

export default function WholesaleClients() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const { decryptObject, isReady: encryptionIsReady } = useEncryption();
  const queryClient = useQueryClient();
  const { preferences, savePreferences } = useTablePreferences("wholesale-clients-table");

  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);

  useAdminKeyboardShortcuts({
    onCreate: () => {
      setCreateClientDialogOpen(true);
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>(preferences.customFilters?.filter || "all");
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; client?: WholesaleClient }>({ open: false });

  // Save preferences when filter changes
  useEffect(() => {
    savePreferences({ customFilters: { filter } });
  }, [filter, savePreferences]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsClient, setSmsClient] = useState<WholesaleClient | null>(null);
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
        .select("*, wholesale_payments(amount)")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filter === "active") {
        query = query.eq("status", "active");
      } else if (filter === "credit_approved") {
        query = query.gt("credit_limit", 0);
      } else if (filter === "overdue") {
        query = query.gt("outstanding_balance", 10000);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Wholesale clients are NOT encrypted - use plaintext fields directly
      // Map to expected format
      return (data || []).map((client: any) => ({
        ...client,
        territory: (client.address || '').split(',')[1]?.trim() || 'Unknown',
        monthly_volume_lbs: client.monthly_volume,
        total_spent: client.wholesale_payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
      })) as WholesaleClient[];
    }
  });

  const filteredClients = clients?.filter(client =>
    client.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleUpdateClient = async (clientId: string, updates: Record<string, any>) => {
    if (!tenant?.id) {
      toast.error("Tenant context required");
      return;
    }

    try {
      const { error } = await supabase
        .from('wholesale_clients')
        .update(updates)
        .eq('id', clientId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      toast.success("Client updated successfully");
      handleRefresh();
    } catch (error) {
      logger.error('Error updating client:', error);
      toast.error("Failed to update client");
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="w-full max-w-full space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">💼 Wholesale Clients</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">B2B Relationships & Credit Management</p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <ExportButton
              data={filteredClients || []}
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
              onClick={() => setImportDialogOpen(true)}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation flex-1 sm:flex-initial min-w-[100px]"
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
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 min-h-[44px] text-sm sm:text-base"
                />
              </div>
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
                variant={filter === "overdue" ? "default" : "outline"}
                size="sm"
                className="min-h-[44px] touch-manipulation text-xs sm:text-sm border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setFilter("overdue")}
              >
                Overdue
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
                    <TableHead className="text-xs sm:text-sm">Client</TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-xs sm:text-sm">Type</TableHead>
                    <TableHead className="text-xs sm:text-sm">Contact</TableHead>
                    <TableHead className="text-xs sm:text-sm">Credit Status</TableHead>
                    <TableHead className="text-xs sm:text-sm">Reliability</TableHead>
                    <TableHead className="text-xs sm:text-sm">This Month</TableHead>
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
                  ) : filteredClients && filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                      <TableRow
                        key={client.id}
                        className="cursor-pointer hover:bg-muted/50 touch-manipulation"
                        onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/big-plug-clients/${client.id}`)}
                      >
                        <TableCell className="text-xs sm:text-sm">
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <CustomerQuickViewCard customer={client}>
                                <span className="truncate">{client.business_name}</span>
                              </CustomerQuickViewCard>
                              <CopyButton text={client.id} label="Client ID" showLabel={false} className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{client.territory}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <ClientStatusBadge status={client.status || 'active'} />
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <Select
                            defaultValue={client.client_type}
                            onValueChange={(value) => handleUpdateClient(client.id, { client_type: value })}
                          >
                            <SelectTrigger className="h-8 w-[100px] border-none bg-transparent hover:bg-muted/50 focus:ring-0 p-0">
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
                        <TableCell className="text-xs sm:text-sm">
                          <div>
                            <div className="text-xs sm:text-sm text-foreground truncate">{client.contact_name}</div>
                            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              {client.email && (
                                <>
                                  {client.email}
                                  <CopyButton text={client.email} label="Email" showLabel={false} className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{client.phone}</div>
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
                                    className="h-8"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleUpdateClient(client.id, { credit_limit: Number(e.currentTarget.value) });
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = Number(e.target.value);
                                      if (val !== client.credit_limit) {
                                        handleUpdateClient(client.id, { credit_limit: val });
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
                            score={client.risk_score ?? client.reliability_score ?? null}
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setSmsClient(client);
                                setSmsDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-[48px] min-w-[48px] touch-manipulation"
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
                              onClick={(e) => {
                                e.stopPropagation();
                                if (tenant?.slug) {
                                  navigate(`/${tenant.slug}/admin/new-wholesale-order?clientId=${client.id}`);
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
                          icon={Package}
                          title={searchTerm ? "No Clients Found" : "No Clients Yet"}
                          description={searchTerm ? "No clients found matching your search criteria." : "Get started by adding your first wholesale client."}
                          primaryAction={{
                            label: "Add Your First Client",
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
            ) : filteredClients && filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <Card
                  key={client.id}
                  className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
                  onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/big-plug-clients/${client.id}`)}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ClientStatusBadge status={client.status || 'active'} showIcon={false} className="text-[10px] px-1.5 h-5" />
                          <h3 className="font-semibold text-base truncate">{client.business_name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{client.territory}</p>
                        <Badge variant="outline" className="text-xs mt-1">{getClientTypeLabel(client.client_type)}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</div>
                        <div className="text-sm">
                          <p className="truncate">{client.contact_name}</p>
                          <p className="text-muted-foreground truncate">{client.phone}</p>
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
                            score={client.risk_score ?? client.reliability_score ?? null}
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
                          onClick={() => {
                            setSmsClient(client);
                            setSmsDialogOpen(true);
                          }}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          <span className="text-xs">Message</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-[48px] min-w-[48px] flex-1 min-w-[100px]"
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
                          onClick={() => {
                            if (tenant?.slug) {
                              navigate(`/${tenant.slug}/admin/new-wholesale-order?clientId=${client.id}`);
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
                  icon={Package}
                  title={searchTerm ? "No Clients Found" : "No Clients Yet"}
                  description={searchTerm ? "No clients found matching your search criteria." : "Get started by adding your first wholesale client."}
                  primaryAction={{
                    label: "Add Your First Client",
                    onClick: () => setCreateClientDialogOpen(true),
                    icon: Plus
                  }}
                />
              </div>
            )}
          </div>
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

        {/* SMS Dialog */}
        {smsClient && (
          <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Send SMS to {smsClient.business_name || smsClient.contact_name}</DialogTitle>
              </DialogHeader>
              {/* SendSMS removed per plan - can be re-added if needed */}
              <div className="p-4 text-center text-muted-foreground">
                SMS functionality temporarily unavailable
              </div>
            </DialogContent>
          </Dialog>
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
                          if (!error) imported++;
                        }
                      }

                      toast.success(`Imported ${imported} clients successfully`);
                      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.lists() });
                      setImportDialogOpen(false);
                      setImportFile(null);
                    } catch (error) {
                      logger.error('Import failed', error);
                      toast.error('Failed to import clients');
                    } finally {
                      setImporting(false);
                    }
                  }}
                  disabled={!importFile || importing}
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
