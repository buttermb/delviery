import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { showInfoToast } from "@/utils/toastHelpers";

export default function FinancialCenter() {
  const navigate = useNavigate();
  const todaySnapshot = {
    revenue: 45200,
    cost: 28000,
    net_profit: 17200,
    margin: 38,
    deals: 6
  };

  const cashFlow = {
    incoming: {
      collections_today: 45200,
      expected_this_week: 125000,
      outstanding: 245000
    },
    outgoing: {
      supplier_payments: 28000,
      payroll: 15000,
      operating: 8000,
      runner_bonuses: 3000
    }
  };

  const creditOut = {
    total_outstanding: 245000,
    overdue: [
      { client: "Big Mike", amount: 38000, days: 14 },
      { client: "South Bronx", amount: 12000, days: 9 },
      { client: "West Village", amount: 8000, days: 6 }
    ],
    due_this_week: [
      { client: "Queens Network", amount: 18000, due: "Fri" },
      { client: "Eastside", amount: 22000, due: "Thu" }
    ],
    future: 62000
  };

  const creditIn = {
    total_payable: 125000,
    supplier: "Westside Supply",
    due_date: "Dec 5",
    credit_line_total: 500000,
    credit_line_used: 125000
  };

  const monthlyPerformance = {
    revenue: 312000,
    target: 300000,
    cost: 198000,
    gross_profit: 114000,
    margin: 36.5,
    operating_costs: {
      total: 42000,
      payroll: 25000,
      runners: 8000,
      rent: 6000,
      other: 3000
    },
    net_profit: 72000,
    net_margin: 23,
    volume_lbs: 520,
    deals: 47,
    avg_deal_size: 6638
  };

  const topClients = [
    { name: "Eastside Collective", profit: 18400, volume: 62 },
    { name: "Queens Network", profit: 12800, volume: 38 },
    { name: "Big Mike", profit: 11200, volume: 45, warning: "owes $38k" }
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">💰 Financial Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">November 30, 2024</p>
      </div>

      {/* Today's Snapshot */}
      <div>
        <h2 className="text-lg font-semibold mb-3">📊 Today's Snapshot</h2>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Revenue</div>
            <div className="text-3xl font-bold text-emerald-500">
              ${todaySnapshot.revenue.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{todaySnapshot.deals} deals</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">Cost</div>
            <div className="text-3xl font-bold">${todaySnapshot.cost.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">COGS</div>
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
                <span className="font-mono font-semibold">${cashFlow.incoming.collections_today.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected This Week:</span>
                <span className="font-mono font-semibold">${cashFlow.incoming.expected_this_week.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outstanding:</span>
                <span className="font-mono font-semibold">${cashFlow.incoming.outstanding.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline">View Collections</Button>
              <Button size="sm" variant="outline">Send Reminders</Button>
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
                <span className="font-mono">${cashFlow.outgoing.supplier_payments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payroll:</span>
                <span className="font-mono">${cashFlow.outgoing.payroll.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operating:</span>
                <span className="font-mono">${cashFlow.outgoing.operating.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Runner Bonuses:</span>
                <span className="font-mono">${cashFlow.outgoing.runner_bonuses.toLocaleString()}</span>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/admin/wholesale-orders")}
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
            ${creditOut.total_outstanding.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Outstanding</div>
        </div>

        <div className="space-y-4">
          {/* Overdue */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-destructive">OVERDUE (🚨 Priority)</span>
              <span className="font-mono font-bold ml-auto">${creditOut.overdue.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              {creditOut.overdue.map((client, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>• {client.client}: ${client.amount.toLocaleString()} ({client.days} days)</span>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => showInfoToast("Collection", `Initiating collection process for ${client.client}`)}
                  >
                    Collect
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Due This Week */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-semibold">DUE THIS WEEK:</span>
              <span className="font-mono font-bold ml-auto">${creditOut.due_this_week.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}</span>
            </div>
            <div className="space-y-2">
              {creditOut.due_this_week.map((client, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span>• {client.client}: ${client.amount.toLocaleString()} (due {client.due})</span>
                </div>
              ))}
              <div className="text-xs text-muted-foreground">+ 6 others...</div>
            </div>
          </div>

          {/* Future */}
          <div className="text-sm">
            <span className="text-muted-foreground">FUTURE:</span>
            <span className="font-mono font-semibold ml-2">${creditOut.future.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            className="bg-emerald-500 hover:bg-emerald-600"
            onClick={() => navigate("/admin/wholesale-clients")}
          >
            Collections Dashboard
          </Button>
          <Button 
            variant="outline"
            onClick={() => showInfoToast("Reminders", "Payment reminders sent to overdue clients")}
          >
            Send Reminders
          </Button>
          <Button 
            variant="outline"
            onClick={() => showInfoToast("Credit Report", "Generating comprehensive credit report...")}
          >
            Credit Report
          </Button>
        </div>
      </Card>

      {/* Credit In (You Owe) */}
      <Card className="p-6 border-l-4 border-l-blue-500">
        <h2 className="text-lg font-semibold mb-4">🔵 Credit In (You Owe)</h2>
        
        <div className="mb-4">
          <div className="text-3xl font-bold font-mono mb-1">
            ${creditIn.total_payable.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Total Payable</div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">• {creditIn.supplier}</span>
            <span className="font-mono font-bold">${creditIn.total_payable.toLocaleString()}</span>
          </div>
          <div className="text-sm text-muted-foreground mb-3">
            Due {creditIn.due_date} (My main supplier - keep good relationship)
          </div>
          <Button 
            size="sm" 
            className="bg-emerald-500 hover:bg-emerald-600"
            onClick={() => showInfoToast("Payment Scheduled", "Payment to supplier scheduled successfully")}
          >
            Schedule Payment
          </Button>
        </div>

        <div className="text-sm">
          <span className="text-muted-foreground">Available Credit Line:</span>
          <span className="font-mono font-semibold ml-2">
            ${(creditIn.credit_line_total - creditIn.credit_line_used).toLocaleString()} / ${creditIn.credit_line_total.toLocaleString()} remaining
          </span>
        </div>
      </Card>

      {/* Monthly Performance */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          This Month Performance
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Revenue:</span>
              <div className="text-right">
                <div className="font-mono font-bold">${monthlyPerformance.revenue.toLocaleString()}</div>
                <div className="text-xs text-emerald-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Target: ${monthlyPerformance.target.toLocaleString()} | +4%
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-mono">${monthlyPerformance.cost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gross Profit:</span>
              <div className="text-right">
                <div className="font-mono font-bold text-emerald-500">
                  ${monthlyPerformance.gross_profit.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {monthlyPerformance.margin}% margin
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="text-sm font-semibold mb-2">Operating Costs:</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">• Payroll:</span>
                  <span className="font-mono">${monthlyPerformance.operating_costs.payroll.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">• Runners:</span>
                  <span className="font-mono">${monthlyPerformance.operating_costs.runners.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">• Rent/Storage:</span>
                  <span className="font-mono">${monthlyPerformance.operating_costs.rent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">• Other:</span>
                  <span className="font-mono">${monthlyPerformance.operating_costs.other.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">NET PROFIT:</span>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-emerald-500">
                    ${monthlyPerformance.net_profit.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {monthlyPerformance.net_margin}% net margin
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-mono font-bold">{monthlyPerformance.volume_lbs} lbs moved</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deals:</span>
              <span className="font-mono font-bold">{monthlyPerformance.deals} clients</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Deal Size:</span>
              <span className="font-mono font-bold">${monthlyPerformance.avg_deal_size.toLocaleString()}</span>
            </div>

            <div className="pt-3 border-t">
              <div className="text-sm font-semibold mb-2">Top Clients by Profit:</div>
              <div className="space-y-2">
                {topClients.map((client, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="flex justify-between">
                      <span>{idx + 1}. {client.name}</span>
                      <span className="font-mono font-semibold text-emerald-500">
                        ${(client.profit / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {client.volume} lbs this month
                      {client.warning && <span className="text-destructive ml-2">🔴 {client.warning}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline">Detailed Reports</Button>
          <Button variant="outline">P&L Statement</Button>
          <Button variant="outline">Cash Flow</Button>
          <Button variant="outline">Export</Button>
        </div>
      </Card>
    </div>
  );
}
