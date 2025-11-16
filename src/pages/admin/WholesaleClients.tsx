import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  Phone,
  MessageSquare,
  DollarSign,
  Package,
  Star,
  AlertCircle
} from "lucide-react";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { CustomerRiskBadge } from "@/components/admin/CustomerRiskBadge";
import { CreateClientDialog } from "@/components/admin/CreateClientDialog";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
// SendSMS removed per plan - can be re-added if needed
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TakeTourButton } from "@/components/tutorial/TakeTourButton";
import { customersTutorial } from "@/lib/tutorials/tutorialConfig";

export default function WholesaleClients() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; client?: any }>({ open: false });
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsClient, setSmsClient] = useState<any>(null);
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: queryKeys.wholesaleClients.list({ filter }),
    queryFn: async () => {
      let query = supabase
        .from("wholesale_clients")
        .select("*")
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

      // Map to expected format
      return (data || []).map(client => ({
        ...client,
        territory: client.address.split(',')[1]?.trim() || 'Unknown',
        monthly_volume_lbs: client.monthly_volume,
        total_spent: Number(client.outstanding_balance) + 100000 // Estimate
      }));
    }
  });

  const filteredClients = clients?.filter(client =>
    client.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contact_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (balance: number) => {
    if (balance === 0) return "text-primary";
    if (balance > 20000) return "text-destructive";
    return "text-orange-600 dark:text-orange-400";
  };

  const getStatusIcon = (balance: number) => {
    if (balance === 0) return "🟢";
    if (balance > 20000) return "🔴";
    return "🟡";
  };

  const getClientTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      sub_dealer: "Sub-Dealer",
      small_shop: "Small Shop",
      network: "Network/Crew",
      supplier: "Supplier"
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">💼 Wholesale Clients</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">B2B Relationships & Credit Management</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <Button 
            variant="outline"
            size="sm"
            className="min-h-[44px] touch-manipulation flex-1 sm:flex-initial"
            onClick={() => {
              toast.info("Import functionality coming soon", {
                description: "CSV import for bulk client creation will be available in a future update."
              });
            }}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button 
            className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation flex-1 sm:flex-initial"
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
            className="min-h-[44px]"
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
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <div className="inline-block min-w-full align-middle px-2 sm:px-0">
            <Table data-tutorial="customer-list" className="min-w-[800px] sm:min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs sm:text-sm">Client</TableHead>
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
                <TableCell colSpan={7} className="text-center py-8">
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
                  onClick={() => navigate(`/admin/big-plug-clients/${client.id}`)}
                >
                  <TableCell className="text-xs sm:text-sm">
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {getStatusIcon(client.outstanding_balance)}
                        <span className="truncate">{client.business_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{client.territory}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    <Badge variant="outline" className="text-xs">{getClientTypeLabel(client.client_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    <div>
                      <div className="text-xs sm:text-sm text-foreground truncate">{client.contact_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{client.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    <div>
                      <div className={`font-mono font-semibold text-xs sm:text-sm ${getStatusColor(client.outstanding_balance)}`}>
                        ${Number(client.outstanding_balance).toLocaleString()}
                      </div>
                      {client.outstanding_balance > 0 ? (
                        <div className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Outstanding
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-500 mt-1">Paid in full ✅</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    <CustomerRiskBadge 
                      score={(client as any).risk_score ?? client.reliability_score ?? null} 
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
                        className="min-h-[44px] min-w-[44px] touch-manipulation"
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
                        className="min-h-[44px] min-w-[44px] touch-manipulation"
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
                          className="min-h-[44px] min-w-[44px] touch-manipulation"
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
                        className="min-h-[44px] touch-manipulation"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/new-wholesale-order?clientId=${client.id}`);
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
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="text-muted-foreground">
                    {searchTerm ? "No clients found matching your search" : "No clients yet"}
                  </div>
                  <Button className="mt-4 min-h-[44px] touch-manipulation" onClick={() => setCreateClientDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="text-sm sm:text-base">Add Your First Client</span>
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
          </div>
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

      {/* Create Client Dialog */}
      <CreateClientDialog
        open={createClientDialogOpen}
        onOpenChange={setCreateClientDialogOpen}
        onSuccess={() => {
          // Query will automatically refetch due to cache invalidation
        }}
      />
    </div>
  );
}
