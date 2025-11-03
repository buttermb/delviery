import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useNavigate } from "react-router-dom";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { CustomerRiskBadge } from "@/components/admin/CustomerRiskBadge";
import { SendSMS } from "@/components/admin/SendSMS";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function WholesaleClients() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; client?: any }>({ open: false });
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsClient, setSmsClient] = useState<any>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["wholesale-clients", filter],
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
    if (balance === 0) return "text-emerald-500";
    if (balance > 20000) return "text-destructive";
    return "text-yellow-500";
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">💼 Wholesale Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">B2B Relationships & Credit Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600">
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={filter === "credit_approved" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("credit_approved")}
            >
              Credit Approved
            </Button>
            <Button
              variant={filter === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("overdue")}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Overdue
            </Button>
          </div>
        </div>
      </Card>

      {/* Clients Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Credit Status</TableHead>
              <TableHead>Reliability</TableHead>
              <TableHead>This Month</TableHead>
              <TableHead className="text-right">Actions</TableHead>
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/admin/wholesale-clients/${client.id}`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {getStatusIcon(client.outstanding_balance)}
                        {client.business_name}
                      </div>
                      <div className="text-sm text-muted-foreground">{client.territory}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getClientTypeLabel(client.client_type)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm text-foreground">{client.contact_name}</div>
                      <div className="text-xs text-muted-foreground">{client.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className={`font-mono font-semibold ${getStatusColor(client.outstanding_balance)}`}>
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
                  <TableCell>
                    <CustomerRiskBadge 
                      score={client.risk_score ?? client.reliability_score} 
                      showLabel={true}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm font-mono text-foreground">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setSmsClient(client);
                          setSmsDialogOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
                        <Phone className="h-4 w-4" />
                      </Button>
                      {client.outstanding_balance > 0 && (
                        <Button size="sm" variant="destructive" onClick={(e) => {
                          e.stopPropagation();
                          setPaymentDialog({ open: true, client });
                        }}>
                          <DollarSign className="h-4 w-4 mr-1" />
                          Collect
                        </Button>
                      )}
              <Button size="sm" variant="default" onClick={(e) => {
                e.stopPropagation();
                navigate(`/admin/wholesale-clients/new-order?client=${client.id}`);
              }}>
                <Package className="h-4 w-4 mr-1" />
                New Order
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
                  <Button className="mt-4" onClick={() => navigate("/admin/wholesale-clients/new")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Client
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
            <SendSMS
              customerId={smsClient.id}
              customerPhone={smsClient.phone}
              customerName={smsClient.business_name || smsClient.contact_name}
              onSent={() => {
                setSmsDialogOpen(false);
                setSmsClient(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
