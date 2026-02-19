import { logger } from '@/lib/logger';
import { useParams } from "react-router-dom";
import { useTenantNavigate } from "@/hooks/useTenantNavigate";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, MessageSquare, Package, DollarSign, AlertCircle, Star, Edit, Flag, Trash2, Truck, Building2 } from "lucide-react";
import { ClientNotesPanel } from "@/components/admin/ClientNotesPanel";
import { PaymentDialog } from "@/components/admin/PaymentDialog";
import { CustomerRiskBadge } from "@/components/admin/CustomerRiskBadge";
import { EditClientDialog } from "@/components/admin/EditClientDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClientDetail, useClientOrders, useClientPayments } from "@/hooks/useWholesaleData";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showInfoToast, showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { ResponsiveTable } from '@/components/shared/ResponsiveTable';
import { formatCurrency } from '@/lib/formatters';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbContext';

export default function ClientDetail() {
  const { id } = useParams<{ id: string; tenantSlug: string }>();
  const navigate = useTenantNavigate();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [creditLimitDialogOpen, setCreditLimitDialogOpen] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState("");
  const queryClient = useQueryClient();

  // Mutation to delete client
  const deleteClientMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('wholesale_clients')
        .delete()
        .eq('id', id)
        .eq('tenant_id', client?.tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccessToast("Client Removed", `${client?.business_name} has been removed`);
      queryClient.invalidateQueries({ queryKey: ['wholesale-clients'] });
      navigate('wholesale-clients');
    },
    onError: (error) => {
      logger.error("Failed to remove client", error, { component: "ClientDetail", clientId: id });
      showErrorToast("Failed to remove client");
    }
  });

  // Mutation to suspend client
  const suspendClientMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('wholesale_clients')
        .update({ status: 'suspended' })
        .eq('id', id)
        .eq('tenant_id', client?.tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccessToast("Account Suspended", `${client?.business_name} has been suspended`);
      queryClient.invalidateQueries({ queryKey: ['wholesale-client', id] });
    },
    onError: (error) => {
      logger.error("Failed to suspend client", error, { component: "ClientDetail", clientId: id });
      showErrorToast("Failed to suspend client");
    }
  });

  // Mutation to update credit limit
  const updateCreditLimitMutation = useMutation({
    mutationFn: async (newLimit: number) => {
      const { error } = await supabase
        .from('wholesale_clients')
        .update({ credit_limit: newLimit })
        .eq('id', id)
        .eq('tenant_id', client?.tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccessToast("Credit Limit Updated", `New limit: ${formatCurrency(Number(newCreditLimit))}`);
      queryClient.invalidateQueries({ queryKey: ['wholesale-client', id] });
      setCreditLimitDialogOpen(false);
      setNewCreditLimit("");
    },
    onError: (error) => {
      logger.error("Failed to update credit limit", error, { component: "ClientDetail", clientId: id });
      showErrorToast("Failed to update credit limit");
    }
  });

  const { data: client, isLoading: clientLoading } = useClientDetail(id || "");
  const { data: orders = [], isLoading: ordersLoading } = useClientOrders(id || "");
  const { data: _payments = [] } = useClientPayments(id || "");

  // Set breadcrumb label to show client business name
  useBreadcrumbLabel(client?.business_name ?? null);

  if (clientLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Client not found</h2>
              <p className="text-muted-foreground mt-1">
                The client you are looking for does not exist or has been removed.
              </p>
            </div>
            <Button onClick={() => navigate("wholesale-clients")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clients
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate metrics from real data - cast orders to any to handle schema mismatches
  const orderData = orders as any[];
  const paidOrders = orderData.filter(o => o.status === "delivered");
  const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const avgOrderSize = orderData.length > 0
    ? orderData.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) / orderData.length
    : 0;

  const _unpaidOrders = orderData.filter(o =>
    o.status === "pending" || o.status === "assigned" || o.status === "in_transit"
  );

  // Cast client to any to handle schema mismatches
  const clientData = client as any;
  const displayClient = {
    id: clientData.id,
    business_name: clientData.business_name,
    contact_name: clientData.contact_name,
    phone: clientData.phone,
    client_type: clientData.client_type || 'regular',
    outstanding_balance: Number(clientData.outstanding_balance || 0),
    credit_limit: Number(clientData.credit_limit || 0),
    reliability_score: Number(clientData.reliability_score || 100),
    payment_terms: `net_${clientData.payment_terms || 7}`,
    total_spent: totalSpent,
    avg_order_size: avgOrderSize,
    status: clientData.status,
    since: clientData.created_at ? format(new Date(clientData.created_at), "MMM yyyy") : "",
    address: clientData.address || "",
    monthly_volume: Number(clientData.monthly_volume || 0)
  };

  const getStatusColor = (balance: number) => {
    if (balance === 0) return "text-primary";
    if (balance > 20000) return "text-destructive";
    return "text-orange-600 dark:text-orange-400";
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
          <Button variant="ghost" size="icon" onClick={() => navigate("wholesale-clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{displayClient.business_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{getClientTypeLabel(displayClient.client_type)}</Badge>
              <CustomerRiskBadge
                score={(client as { risk_score?: number } & typeof client).risk_score ?? null}
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
            onClick={() => setEditDialogOpen(true)}
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
            onClick={() => setRemoveDialogOpen(true)}
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
                {formatCurrency(displayClient.outstanding_balance)}
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
                  className={`h-4 w-4 ${i < Math.floor(displayClient.reliability_score / 20)
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
        <ResponsiveTable
          keyExtractor={(order: any) => order.id || order.order_number}
          columns={[
            {
              header: 'Order #',
              accessorKey: 'order_number',
              cell: (order: any) => <span className="font-mono">{order.order_number}</span>
            },
            {
              header: 'Date',
              accessorKey: 'created_at',
              cell: (order: any) => order.created_at ? format(new Date(order.created_at), "MMM d") : ""
            },
            {
              header: 'Weight',
              cell: () => "-"
            },
            {
              header: 'Amount',
              accessorKey: 'total_amount',
              cell: (order: any) => <span className="font-mono">{formatCurrency(Number(order.total_amount))}</span>
            },
            {
              header: 'Status',
              accessorKey: 'status',
              cell: (order: any) => {
                const isDelivered = order.status === "delivered";
                const isPending = order.status === "pending" || order.status === "assigned" || order.status === "in_transit";

                return (
                  <>
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
                    {!isPending && !isDelivered && order.status !== "cancelled" && (
                      <Badge variant="outline">{order.status}</Badge>
                    )}
                  </>
                );
              }
            }
          ]}
          data={orders.slice(0, 10)}
          isLoading={ordersLoading}
          emptyState={{
            icon: Package,
            title: "No Recent Orders",
            description: "This client hasn't placed any orders yet.",
            compact: true
          }}
          mobileRenderer={(order: any) => (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono font-semibold">{order.order_number}</span>
                <span className="text-sm text-muted-foreground">
                  {order.created_at ? format(new Date(order.created_at), "MMM d") : ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono font-medium">{formatCurrency(Number(order.total_amount))}</span>
                <div>
                  {order.status === "pending" && (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
                      ⚠️ PENDING
                    </Badge>
                  )}
                  {order.status === "delivered" && (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                      ✅ Delivered
                    </Badge>
                  )}
                  {order.status === "cancelled" && (
                    <Badge variant="destructive" className="text-xs">❌ Cancelled</Badge>
                  )}
                  {order.status !== "pending" && order.status !== "delivered" && order.status !== "cancelled" && (
                    <Badge variant="outline" className="text-xs">{order.status}</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        />
      </Card>

      {/* Client Notes */}
      <ClientNotesPanel clientId={id || ""} />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          className="bg-emerald-500 hover:bg-emerald-600"
          onClick={() => navigate("wholesale-orders/new", { state: { clientId: id, clientName: displayClient.business_name } })}
        >
          <Package className="h-4 w-4 mr-2" />
          New Order
        </Button>
        <Button
          className="bg-amber-600 hover:bg-amber-700"
          onClick={() => navigate("dispatch-inventory", { state: { clientId: id } })}
        >
          <Truck className="h-4 w-4 mr-2" />
          Front Inventory
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setNewCreditLimit(displayClient.credit_limit.toString());
            setCreditLimitDialogOpen(true);
          }}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Adjust Credit Limit
        </Button>
        <Button
          variant="destructive"
          onClick={() => setSuspendDialogOpen(true)}
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

      {/* Edit Client Dialog */}
      <EditClientDialog
        clientId={id || ""}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => {
          // Refresh client data
          window.location.reload();
        }}
      />

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send SMS to {displayClient.business_name}</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center text-muted-foreground">
            SMS functionality temporarily unavailable
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={removeDialogOpen}
        onOpenChange={setRemoveDialogOpen}
        onConfirm={() => deleteClientMutation.mutate()}
        itemName={displayClient.business_name}
        itemType="client"
        title="Remove Client"
        description={`Are you sure you want to remove ${displayClient.business_name}? This action cannot be undone.`}
        isLoading={deleteClientMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        onConfirm={() => suspendClientMutation.mutate()}
        itemName={displayClient.business_name}
        itemType="account"
        title="Suspend Account"
        description={`Are you sure you want to suspend ${displayClient.business_name}'s account?`}
        destructive={true}
        isLoading={suspendClientMutation.isPending}
      />

      {/* Credit Limit Dialog */}
      <Dialog open={creditLimitDialogOpen} onOpenChange={setCreditLimitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Credit Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Limit: {formatCurrency(displayClient.credit_limit)}</Label>
              <Input
                type="number"
                placeholder="Enter new credit limit"
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreditLimitDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newCreditLimit && !isNaN(Number(newCreditLimit))) {
                    updateCreditLimitMutation.mutate(Number(newCreditLimit));
                  }
                }}
                disabled={updateCreditLimitMutation.isPending || !newCreditLimit}
              >
                {updateCreditLimitMutation.isPending ? "Updating..." : "Update Limit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
