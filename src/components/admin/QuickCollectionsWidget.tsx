import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Phone } from "lucide-react";
import { useWholesaleClients, useWholesaleOrders } from "@/hooks/useWholesaleData";
import { differenceInDays } from "date-fns";
import { useState } from "react";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { PaymentDialog } from "./PaymentDialog";
import type { WholesaleClient } from "@/types/admin";

export function QuickCollectionsWidget() {
  const { navigateToAdmin } = useTenantNavigation();
  const { data: clients = [] } = useWholesaleClients();
  const { data: orders = [] } = useWholesaleOrders();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<WholesaleClient | null>(null);

  // Find clients with overdue balances
  const overdueClients = clients
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
        ? differenceInDays(new Date(), new Date(oldestOrder.created_at))
        : 0;

      return {
        ...client,
        daysOutstanding
      };
    })
    .filter(c => c.daysOutstanding > 7)
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding)
    .slice(0, 3);

  if (overdueClients.length === 0) return null;

  return (
    <>
      <Card className="p-5 border-warning/20 bg-warning/5">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="h-5 w-5 text-warning" />
          <h3 className="font-semibold text-warning">⚠️ Collections Needed</h3>
        </div>

        <div className="space-y-3">
          {overdueClients.map(client => (
            <div key={client.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div className="flex-1">
                <div className="font-semibold text-foreground">{client.business_name}</div>
                <div className="text-sm text-muted-foreground">
                  {client.daysOutstanding} days overdue
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-3">
                  <div className="font-mono font-bold text-destructive">
                    ${Number(client.outstanding_balance).toLocaleString()}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setSelectedClient(client as WholesaleClient);
                    setPaymentDialogOpen(true);
                  }}
                >
                  <Phone className="h-3 w-3 mr-1" />
                  Collect
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t text-center">
          <Button 
            variant="link" 
            size="sm" 
            className="text-warning"
            onClick={() => navigateToAdmin("wholesale-clients")}
          >
            View All Collections →
          </Button>
        </div>
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
    </>
  );
}
