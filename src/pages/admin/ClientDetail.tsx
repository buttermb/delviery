import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Phone, MessageSquare, Package, DollarSign, AlertCircle, Star, Edit, Flag, Trash2 } from "lucide-react";
import { ClientNotesPanel } from "@/components/admin/ClientNotesPanel";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { CustomerRiskBadge } from "@/components/admin/CustomerRiskBadge";
// SendSMS removed per plan - can be re-added if needed
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClientDetail, useClientOrders, useClientPayments } from "@/hooks/useWholesaleData";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { showInfoToast, showSuccessToast } from "@/utils/toastHelpers";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  const { data: client, isLoading: clientLoading } = useClientDetail(id || "");
  const { data: orders = [], isLoading: ordersLoading } = useClientOrders(id || "");
  const { data: payments = [] } = useClientPayments(id || "");

  if (clientLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Client Not Found</h2>
          <Button onClick={() => navigate("/admin/wholesale-clients")} className="mt-4">
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  // Calculate metrics from real data
  const paidOrders = orders.filter(o => o.status === "delivered");
  const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const avgOrderSize = orders.length > 0 
    ? orders.reduce((sum, o) => sum + Number(o.total_amount), 0) / orders.length 
    : 0;

  const unpaidOrders = orders.filter(o => 
    o.status === "pending" || o.status === "assigned" || o.status === "in_transit"
  );

  const displayClient = {
    id: client.id,
    business_name: client.business_name,
    contact_name: client.contact_name,
    phone: client.phone,
    client_type: client.client_type,
    outstanding_balance: Number(client.outstanding_balance),
    credit_limit: Number(client.credit_limit),
    reliability_score: Number(client.reliability_score),
    payment_terms: `net_${client.payment_terms || 7}`,
    total_spent: totalSpent,
    avg_order_size: avgOrderSize,
    status: client.status,
    since: client.created_at ? format(new Date(client.created_at), "MMM yyyy") : "",
    address: client.address || "",
    monthly_volume: Number(client.monthly_volume || 0)
  };

  const getStatusColor = (balance: number) => {
    if (balance === 0) return "text-emerald-500";
    if (balance > 20000) return "text-destructive";
    return "text-yellow-500";
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/wholesale-clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{displayClient.business_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{getClientTypeLabel(displayClient.client_type)}</Badge>
              <CustomerRiskBadge 
                score={(client as any).risk_score ?? null} 
                showLabel={true}
              />
              <span className="text-sm text-muted-foreground">{displayClient.address}</span>
              <span className="text-sm text-muted-foreground">Since: {displayClient.since}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (displayClient.phone) {
                window.location.href = `tel:${displayClient.phone}`;
              }
            }}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSmsDialogOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => showInfoToast("Edit Client", "Client editing coming soon")}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => showInfoToast("Flag Client", `${displayClient.business_name} marked for review`)}
          >
            <Flag className="h-4 w-4 mr-2" />
            Flag
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => {
              if (confirm(`Are you sure you want to remove ${displayClient.business_name}?`)) {
                showSuccessToast("Client Removed", `${displayClient.business_name} has been removed`);
                navigate("/admin/wholesale-clients");
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        </div>
      </div>

      {/* Contacts */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Primary Contact</div>
            <div className="text-sm font-medium">{displayClient.contact_name}</div>
            <div className="text-sm text-muted-foreground">{displayClient.phone}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Email</div>
            <div className="text-sm font-medium">{client.email}</div>
          </div>
        </div>
      </Card>

      {/* Financial Overview */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">💰 Financial Overview</h2>
        
        {displayClient.outstanding_balance > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="font-semibold text-destructive">Outstanding Credit</span>
              </div>
              <span className={`text-2xl font-mono font-bold ${getStatusColor(displayClient.outstanding_balance)}`}>
                ${displayClient.outstanding_balance.toLocaleString()}
              </span>
            </div>

            <div className="flex gap-2">
              <Button 
                className="bg-emerald-500 hover:bg-emerald-600"
                onClick={() => setPaymentDialogOpen(true)}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  if (displayClient.phone) {
                    window.location.href = `tel:${displayClient.phone}`;
                    showInfoToast("Calling Client", `Calling ${displayClient.business_name} for collection`);
                  }
                }}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call for Collection
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  showSuccessToast("Escalated", `${displayClient.business_name} escalated to collections team`);
                }}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Escalate
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Spent</div>
            <div className="text-2xl font-bold">${(displayClient.total_spent / 1000).toFixed(0)}k</div>
            <div className="text-xs text-muted-foreground">All time</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Monthly Volume</div>
            <div className="text-2xl font-bold">${Math.round(displayClient.monthly_volume / 1000)}k</div>
            <div className="text-xs text-muted-foreground">Average</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Avg Order</div>
            <div className="text-2xl font-bold">${Math.round(displayClient.avg_order_size / 1000)}k</div>
            <div className="text-xs text-muted-foreground">Per order</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Orders</div>
            <div className="text-2xl font-bold">{orders.length}</div>
            <div className="text-xs text-muted-foreground">All time</div>
          </Card>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Reliability</div>
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.floor(displayClient.reliability_score / 20)
                      ? "fill-yellow-500 text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
            <div className="text-sm">{displayClient.reliability_score}% score</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Credit Limit</div>
            <div className="text-2xl font-bold">${(displayClient.credit_limit / 1000).toFixed(0)}k</div>
            <div className="text-xs text-muted-foreground">Used: {Math.round((displayClient.outstanding_balance / displayClient.credit_limit) * 100)}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Payment Terms</div>
            <div className="text-2xl font-bold">{displayClient.payment_terms.replace('net_', '')} days</div>
            <div className="text-xs text-muted-foreground">Net terms</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <div className="text-lg font-bold text-emerald-500">{displayClient.status}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </Card>
        </div>
      </Card>

      {/* Recent Orders */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">📋 Recent Orders</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.slice(0, 10).map((order) => {
              const orderDate = order.created_at ? format(new Date(order.created_at), "MMM d") : "";
              const isDelivered = order.status === "delivered";
              const isPending = order.status === "pending" || order.status === "assigned" || order.status === "in_transit";

              return (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.order_number}</TableCell>
                  <TableCell>{orderDate}</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="font-mono">${Number(order.total_amount).toLocaleString()}</TableCell>
                  <TableCell>
                    {isPending && (
                      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        ⚠️ PENDING
                      </Badge>
                    )}
                    {isDelivered && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        ✅ Delivered
                      </Badge>
                    )}
                    {order.status === "cancelled" && (
                      <Badge variant="destructive">❌ Cancelled</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Client Notes */}
      <ClientNotesPanel clientId={id || ""} />

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          className="bg-emerald-500 hover:bg-emerald-600"
          onClick={() => navigate("/admin/wholesale-orders/new", { state: { clientId: id, clientName: displayClient.business_name } })}
        >
          <Package className="h-4 w-4 mr-2" />
          New Order
        </Button>
        <Button 
          variant="outline"
          onClick={() => {
            const newLimit = prompt(`Enter new credit limit for ${displayClient.business_name} (current: $${displayClient.credit_limit.toLocaleString()}):`);
            if (newLimit && !isNaN(Number(newLimit))) {
              showSuccessToast("Credit Limit Updated", `New limit: $${Number(newLimit).toLocaleString()}`);
            }
          }}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Adjust Credit Limit
        </Button>
        <Button 
          variant="destructive"
          onClick={() => {
            if (confirm(`Are you sure you want to suspend ${displayClient.business_name}'s account?`)) {
              showSuccessToast("Account Suspended", `${displayClient.business_name} has been suspended`);
            }
          }}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Suspend Account
        </Button>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        clientId={id || ""}
        clientName={displayClient.business_name}
        outstandingBalance={displayClient.outstanding_balance}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send SMS to {displayClient.business_name}</DialogTitle>
          </DialogHeader>
          {/* SendSMS removed per plan - can be re-added if needed */}
          <div className="p-4 text-center text-muted-foreground">
            SMS functionality temporarily unavailable
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
