import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { useTenantNavigation } from "@/lib/navigation/tenantNavigation";
import { useFinancialSnapshot, useCashFlow, useCreditOut, useMonthlyPerformance, useCreatePaymentSchedule, useCreateCollectionActivity } from "@/hooks/useFinancialData";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export default function FinancialCenter() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  // Enable realtime sync for payments, earnings, and orders (for revenue updates)
  useRealtimeSync({
    tenantId,
    tables: ['wholesale_payments', 'courier_earnings', 'orders', 'wholesale_orders'],
    enabled: !!tenantId,
  });
  const { navigateToAdmin } = useTenantNavigation();
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; amount: number } | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ amount: "", due_date: "", notes: "" });

  const { data: snapshot, isLoading: snapshotLoading } = useFinancialSnapshot();
  const { data: cashFlow, isLoading: cashFlowLoading } = useCashFlow();
  const { data: creditOut, isLoading: creditOutLoading } = useCreditOut();
  const { data: monthlyPerformance, isLoading: monthlyLoading } = useMonthlyPerformance();

  const createCollection = useCreateCollectionActivity();
  const createSchedule = useCreatePaymentSchedule();

  if (snapshotLoading || cashFlowLoading || creditOutLoading || monthlyLoading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  const todaySnapshot = snapshot || { revenue: 0, cost: 0, net_profit: 0, margin: 0, deals: 0 };
  const cashFlowData = cashFlow || { incoming: { collections_today: 0, expected_this_week: 0, outstanding: 0 }, outgoing: { supplier_payments: 0, payroll: 0, operating: 0, runner_bonuses: 0 } };
  const creditOutData = creditOut || { total_outstanding: 0, overdue: [], due_this_week: [], future: 0 };
  const monthlyData = monthlyPerformance || { revenue: 0, cost: 0, gross_profit: 0, margin: 0, deals: 0, avg_deal_size: 0 };

  const handleCollect = (client: { id: string; name: string; amount: number }) => {
    setSelectedClient(client);
    setCollectionDialogOpen(true);
  };

  const _handleSchedulePayment = () => {
    setScheduleDialogOpen(true);
  };

  const submitCollection = async (notes: string) => {
    if (!selectedClient) return;
    
    await createCollection.mutateAsync({
      client_id: selectedClient.id,
      activity_type: "collection_call",
      amount: selectedClient.amount,
      notes
    });
    
    setCollectionDialogOpen(false);
    setSelectedClient(null);
  };

  const submitSchedule = async () => {
    if (!scheduleData.amount || !scheduleData.due_date) return;
    
    // For now, schedule for first overdue client
    const firstClient = creditOutData.overdue[0];
    if (!firstClient) return;

    await createSchedule.mutateAsync({
      client_id: firstClient.client_id,
      amount: parseFloat(scheduleData.amount),
      due_date: new Date(scheduleData.due_date).toISOString(),
      notes: scheduleData.notes
    });
    
    setScheduleDialogOpen(false);
    setScheduleData({ amount: "", due_date: "", notes: "" });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">💰 Financial Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">November 30, 2024</p>
      </div>

      {/* Today's Snapshot - Real-time Completed Orders Data */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">📊 Today's Snapshot</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToAdmin('reports/revenue')}
            className="text-xs"
          >
            View Full Reports →
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Completed Revenue</div>
            <div className="text-3xl font-bold text-emerald-500">
              ${todaySnapshot.revenue.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {(todaySnapshot as { completedDeals?: number }).completedDeals || todaySnapshot.deals} completed orders
            </div>
            {(todaySnapshot as { pendingRevenue?: number }).pendingRevenue !== undefined && (todaySnapshot as { pendingRevenue?: number }).pendingRevenue! > 0 && (
              <div className="text-xs text-amber-500 mt-1">
                +${((todaySnapshot as { pendingRevenue?: number }).pendingRevenue || 0).toLocaleString()} pending
              </div>
            )}
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Cost (COGS)</div>
            <div className="text-3xl font-bold">${todaySnapshot.cost.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">Estimated from completed</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Net Profit</div>
            <div className="text-3xl font-bold text-emerald-500">
              ${todaySnapshot.net_profit.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-500 mt-1">{todaySnapshot.margin}% margin</div>
          </Card>
        </div>
      </div>

      {/* Cash Flow */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cash Flow
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Incoming */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-emerald-500">
              <ArrowUpRight className="h-4 w-4" />
              Incoming
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collections Today:</span>
                <span className="font-mono font-semibold">${cashFlowData.incoming.collections_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected This Week:</span>
                <span className="font-mono font-semibold">${cashFlowData.incoming.expected_this_week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding:</span>
                <span className="font-mono font-semibold">${cashFlowData.incoming.outstanding.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => navigateToAdmin('wholesale-clients')}>
                View Collections
              </Button>
            </div>
          </div>

          {/* Outgoing */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <ArrowDownRight className="h-4 w-4" />
              Outgoing
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier Payments:</span>
                <span className="font-mono">${cashFlowData.outgoing.supplier_payments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payroll:</span>
                <span className="font-mono">${cashFlowData.outgoing.payroll.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operating:</span>
                <span className="font-mono">${cashFlowData.outgoing.operating.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Runner Bonuses:</span>
                <span className="font-mono">${cashFlowData.outgoing.runner_bonuses.toLocaleString()}</span>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-4"
              onClick={() => navigateToAdmin('wholesale-orders')}
            >
              View Payables
            </Button>
          </div>
        </div>
      </Card>

      {/* Credit Out (Who Owes You) */}
      <Card className="p-6 border-l-4 border-l-yellow-500">
        <h2 className="text-lg font-semibold mb-4">🔴 Credit Out (Who Owes You)</h2>
        
        <div className="mb-4">
          <div className="text-3xl font-bold font-mono mb-1">
            ${creditOutData.total_outstanding.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Outstanding</div>
        </div>

        <div className="space-y-4">
          {/* Overdue */}
          {creditOutData.overdue.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="font-semibold text-destructive">OVERDUE (🚨 Priority)</span>
                <span className="font-mono font-bold ml-auto">
                  ${creditOutData.overdue.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2">
                {creditOutData.overdue.map((client, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>• {client.client}: ${client.amount.toLocaleString()} ({client.days} days)</span>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleCollect({ id: client.client_id, name: client.client, amount: client.amount })}
                    >
                      Collect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            className="bg-emerald-500 hover:bg-emerald-600"
            onClick={() => navigateToAdmin('wholesale-clients')}
          >
            Collections Dashboard
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigateToAdmin('reports')}
          >
            View Reports
          </Button>
        </div>
      </Card>


      {/* Monthly Performance - Real-time from Completed Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            This Month Performance
          </h2>
          <Badge variant="outline" className="text-xs">
            Real-time from completed orders
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Revenue:</span>
              <div className="text-right">
                <div className="font-mono font-bold">${monthlyData.revenue.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  from {(monthlyData as { completedDeals?: number }).completedDeals || monthlyData.deals} completed
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-mono">${monthlyData.cost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gross Profit:</span>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-500">
                  ${monthlyData.gross_profit.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {monthlyData.margin}% margin
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Orders:</span>
              <span className="font-mono font-bold">{monthlyData.deals} orders</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Deal Size:</span>
              <span className="font-mono font-bold">${monthlyData.avg_deal_size.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={() => navigateToAdmin("reports/revenue")}>
            Revenue Reports
          </Button>
          <Button variant="ghost" onClick={() => navigateToAdmin("reports")}>
            All Reports
          </Button>
        </div>
      </Card>

      {/* Collection Dialog */}
      <Dialog open={collectionDialogOpen} onOpenChange={setCollectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collection Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Client: {selectedClient?.name}</p>
              <p className="text-sm font-mono font-bold">Outstanding: ${selectedClient?.amount.toLocaleString()}</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea 
                placeholder="Record collection activity notes..."
                rows={4}
                id="collection-notes"
              />
            </div>
            <Button 
              className="w-full"
              onClick={() => {
                const notes = (document.getElementById("collection-notes") as HTMLTextAreaElement)?.value;
                submitCollection(notes);
              }}
            >
              Log Collection Activity
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Payment Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={scheduleData.amount}
                onChange={(e) => setScheduleData({ ...scheduleData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={scheduleData.due_date}
                onChange={(e) => setScheduleData({ ...scheduleData, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={scheduleData.notes}
                onChange={(e) => setScheduleData({ ...scheduleData, notes: e.target.value })}
                placeholder="Payment schedule notes..."
                rows={3}
              />
            </div>
            <Button 
              className="w-full"
              onClick={submitSchedule}
              disabled={!scheduleData.amount || !scheduleData.due_date}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
