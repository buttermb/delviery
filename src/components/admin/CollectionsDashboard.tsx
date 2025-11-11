import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Phone, MessageSquare, DollarSign } from "lucide-react";
import { useWholesaleClients, useWholesaleOrders } from "@/hooks/useWholesaleData";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";
import { PaymentDialog } from "./PaymentDialog";
// SendSMS removed per plan - can be re-added if needed
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showInfoToast } from "@/utils/toastHelpers";
import type { WholesaleClient } from "@/types/admin";

export function CollectionsDashboard() {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<WholesaleClient | null>(null);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsClient, setSmsClient] = useState<WholesaleClient | null>(null);
  const { data: clients = [] } = useWholesaleClients();
  const { data: orders = [] } = useWholesaleOrders();

  // Calculate aging buckets
  const now = new Date();
  
  const clientsWithAging = clients
    .filter(c => Number(c.outstanding_balance) > 0)
    .map(client => {
      const clientOrders = orders.filter(o => 
        o.client_id === client.id && 
        o.status !== "delivered" && 
        o.status !== "cancelled"
      );

      const oldestOrder = clientOrders
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      
      const daysOutstanding = oldestOrder 
        ? differenceInDays(now, new Date(oldestOrder.created_at))
        : 0;

      let agingBucket: "current" | "1-7" | "8-14" | "15-30" | "30+" = "current";
      if (daysOutstanding > 30) agingBucket = "30+";
      else if (daysOutstanding > 14) agingBucket = "15-30";
      else if (daysOutstanding > 7) agingBucket = "8-14";
      else if (daysOutstanding > 0) agingBucket = "1-7";

      return {
        ...client,
        daysOutstanding,
        agingBucket,
        orderCount: clientOrders.length
      };
    })
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding);

  const criticalAccounts = clientsWithAging.filter(c => c.agingBucket === "30+" || c.agingBucket === "15-30");
  const watchList = clientsWithAging.filter(c => c.agingBucket === "8-14");

  const agingSummary = {
    "current": clientsWithAging.filter(c => c.agingBucket === "current").reduce((sum, c) => sum + Number(c.outstanding_balance), 0),
    "1-7": clientsWithAging.filter(c => c.agingBucket === "1-7").reduce((sum, c) => sum + Number(c.outstanding_balance), 0),
    "8-14": clientsWithAging.filter(c => c.agingBucket === "8-14").reduce((sum, c) => sum + Number(c.outstanding_balance), 0),
    "15-30": clientsWithAging.filter(c => c.agingBucket === "15-30").reduce((sum, c) => sum + Number(c.outstanding_balance), 0),
    "30+": clientsWithAging.filter(c => c.agingBucket === "30+").reduce((sum, c) => sum + Number(c.outstanding_balance), 0)
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-500" />
          Collections Dashboard
        </h2>

        {/* Aging Summary */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          <Card className="p-3 bg-emerald-500/5 border-emerald-500/20">
            <div className="text-xs text-muted-foreground mb-1">Current</div>
            <div className="text-lg font-bold font-mono">${(agingSummary.current / 1000).toFixed(0)}k</div>
          </Card>
          <Card className="p-3 bg-blue-500/5 border-blue-500/20">
            <div className="text-xs text-muted-foreground mb-1">1-7 Days</div>
            <div className="text-lg font-bold font-mono">${(agingSummary["1-7"] / 1000).toFixed(0)}k</div>
          </Card>
          <Card className="p-3 bg-yellow-500/5 border-yellow-500/20">
            <div className="text-xs text-muted-foreground mb-1">8-14 Days</div>
            <div className="text-lg font-bold font-mono">${(agingSummary["8-14"] / 1000).toFixed(0)}k</div>
          </Card>
          <Card className="p-3 bg-orange-500/5 border-orange-500/20">
            <div className="text-xs text-muted-foreground mb-1">15-30 Days</div>
            <div className="text-lg font-bold font-mono">${(agingSummary["15-30"] / 1000).toFixed(0)}k</div>
          </Card>
          <Card className="p-3 bg-destructive/10 border-destructive/20">
            <div className="text-xs text-muted-foreground mb-1">30+ Days</div>
            <div className="text-lg font-bold font-mono text-destructive">
              ${(agingSummary["30+"] / 1000).toFixed(0)}k
            </div>
          </Card>
        </div>

        {/* Critical Accounts */}
        {criticalAccounts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              CRITICAL - Immediate Action Required ({criticalAccounts.length})
            </h3>
            <div className="space-y-2">
              {criticalAccounts.slice(0, 5).map(client => (
                <Card key={client.id} className="p-4 border-l-4 border-l-destructive">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{client.business_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {client.daysOutstanding} days overdue | {client.orderCount} unpaid orders
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="text-xl font-mono font-bold text-destructive">
                        ${Number(client.outstanding_balance).toLocaleString()}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => {
                            setSelectedClient(client);
                            setPaymentDialogOpen(true);
                          }}
                        >
                          <Phone className="h-3 w-3 mr-1" />
                          Call
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSmsClient(client);
                            setSmsDialogOpen(true);
                          }}
                        >
                          <MessageSquare className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Watch List */}
        {watchList.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-yellow-600">
              ⚠️ WATCH LIST - Send Reminders ({watchList.length})
            </h3>
            <div className="space-y-2">
              {watchList.slice(0, 5).map(client => (
                <Card key={client.id} className="p-3 border-l-2 border-l-yellow-500 bg-yellow-500/5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{client.business_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {client.daysOutstanding} days | {client.orderCount} orders
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold">
                        ${Number(client.outstanding_balance).toLocaleString()}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-1"
                        onClick={() => {
                          showInfoToast("Reminder Sent", `Payment reminder sent to ${client.business_name}`);
                        }}
                      >
                        Send Reminder
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {clientsWithAging.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>All accounts current! 🎉</p>
          </div>
        )}
      </Card>

      {selectedClient && (
        <PaymentDialog
          clientId={selectedClient.id}
          clientName={selectedClient.business_name}
          outstandingBalance={Number(selectedClient.outstanding_balance || 0)}
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
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
    </div>
  );
}
