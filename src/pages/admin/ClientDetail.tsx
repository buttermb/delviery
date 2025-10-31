import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Phone, MessageSquare, Package, DollarSign, AlertCircle, Star, Edit, Flag, Trash2 } from "lucide-react";

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock data until database is populated
  const client = {
    id: id || "1",
    business_name: "Big Mike's Operation",
    contact_name: "Mike Johnson",
    phone: "555-1234",
    secondary_contact_name: "Tommy Lee",
    secondary_phone: "555-5555",
    client_type: "sub_dealer",
    territory: "Brooklyn East",
    outstanding_balance: 38000,
    credit_limit: 50000,
    reliability_score: 68,
    payment_terms: "net_7",
    monthly_volume_lbs: 45,
    total_spent: 1200000,
    avg_order_size_lbs: 15,
    team_size: 7,
    avg_payment_days: 12,
    status: "active",
    since: "Jan 2023"
  };

  const orders = [
    { id: "1462", date: "Nov 23", weight: 16, amount: 48000, status: "unpaid", days_late: 7 },
    { id: "1458", date: "Nov 16", weight: 22, amount: 66000, status: "overdue", days_late: 14 },
    { id: "1445", date: "Nov 9", weight: 18, amount: 54000, status: "paid", days_to_pay: 10 },
    { id: "1432", date: "Nov 2", weight: 15, amount: 45000, status: "paid", days_to_pay: 8 },
    { id: "1420", date: "Oct 26", weight: 20, amount: 60000, status: "paid", days_to_pay: 12 },
  ];

  const preferredProducts = [
    { name: "Blue Dream", percent: 40, usual_lbs: 20, price_per_lb: 3000 },
    { name: "Wedding Cake", percent: 25, usual_lbs: 10, price_per_lb: 3200 },
    { name: "Gelato", percent: 20, usual_lbs: 10, price_per_lb: 3100 },
    { name: "Various", percent: 15, usual_lbs: 5, price_per_lb: 3000 },
  ];

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
            <h1 className="text-3xl font-bold text-foreground">{client.business_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{getClientTypeLabel(client.client_type)}</Badge>
              <span className="text-sm text-muted-foreground">{client.territory}</span>
              <span className="text-sm text-muted-foreground">Since: {client.since}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message
          </Button>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm">
            <Flag className="h-4 w-4 mr-2" />
            Flag
          </Button>
          <Button variant="destructive" size="sm">
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
            <div className="text-sm font-medium">{client.contact_name}</div>
            <div className="text-sm text-muted-foreground">{client.phone}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Secondary Contact</div>
            <div className="text-sm font-medium">{client.secondary_contact_name}</div>
            <div className="text-sm text-muted-foreground">{client.secondary_phone}</div>
          </div>
        </div>
      </Card>

      {/* Financial Overview */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">💰 Financial Overview</h2>
        
        {client.outstanding_balance > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="font-semibold text-destructive">Outstanding Credit</span>
              </div>
              <span className={`text-2xl font-mono font-bold ${getStatusColor(client.outstanding_balance)}`}>
                ${client.outstanding_balance.toLocaleString()}
              </span>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span>Order #1458 - $22,000</span>
                <span className="text-destructive">14 days late 🚨</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Order #1462 - $16,000</span>
                <span className="text-yellow-500">7 days late ⚠️</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="bg-emerald-500 hover:bg-emerald-600">
                <DollarSign className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
              <Button variant="outline">
                <Phone className="h-4 w-4 mr-2" />
                Call for Collection
              </Button>
              <Button variant="destructive">
                <AlertCircle className="h-4 w-4 mr-2" />
                Escalate
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Total Spent</div>
            <div className="text-2xl font-bold">${(client.total_spent / 1000000).toFixed(1)}M</div>
            <div className="text-xs text-muted-foreground">This year</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Volume (YTD)</div>
            <div className="text-2xl font-bold">{client.monthly_volume_lbs * 12} lbs</div>
            <div className="text-xs text-muted-foreground">{Math.round(client.monthly_volume_lbs * 12 * 0.453592)} kg</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Avg Order</div>
            <div className="text-2xl font-bold">{client.avg_order_size_lbs} lbs</div>
            <div className="text-xs text-muted-foreground">${(client.avg_order_size_lbs * 3000).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Margin</div>
            <div className="text-2xl font-bold">35%</div>
            <div className="text-xs text-muted-foreground">Profit</div>
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
                    i < Math.floor(client.reliability_score / 20)
                      ? "fill-yellow-500 text-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
            <div className="text-sm">{client.reliability_score}% on time</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Credit Limit</div>
            <div className="text-2xl font-bold">${(client.credit_limit / 1000).toFixed(0)}k</div>
            <div className="text-xs text-muted-foreground">Used: {Math.round((client.outstanding_balance / client.credit_limit) * 100)}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Avg Pay Time</div>
            <div className="text-2xl font-bold">{client.avg_payment_days} days</div>
            <div className="text-xs text-muted-foreground">Target: 7</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <div className="text-lg font-bold text-yellow-500">At Risk</div>
            <div className="text-xs text-muted-foreground">Watch closely</div>
          </Card>
        </div>
      </Card>

      {/* Preferred Products */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">📦 Preferred Products</h2>
        <div className="space-y-3 mb-4">
          {preferredProducts.map((product, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{idx + 1}. {product.name}</span>
                  <Badge variant="outline">{product.percent}% of orders</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Usually {product.usual_lbs} lbs @ ${product.price_per_lb.toLocaleString()}/lb
                </div>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full bg-emerald-500 hover:bg-emerald-600">
          <Package className="h-4 w-4 mr-2" />
          Quick Reorder - Usual Mix: 40 lbs total ($120,000)
        </Button>
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
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono">#{order.id}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>{order.weight} lbs</TableCell>
                <TableCell className="font-mono">${order.amount.toLocaleString()}</TableCell>
                <TableCell>
                  {order.status === "overdue" && (
                    <Badge variant="destructive">🔴 OVERDUE ({order.days_late} days)</Badge>
                  )}
                  {order.status === "unpaid" && (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                      ⚠️ UNPAID ({order.days_late} days)
                    </Badge>
                  )}
                  {order.status === "paid" && (
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      ✅ Paid in {order.days_to_pay} days
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button className="bg-emerald-500 hover:bg-emerald-600">
          <Package className="h-4 w-4 mr-2" />
          New Order
        </Button>
        <Button variant="outline">
          <DollarSign className="h-4 w-4 mr-2" />
          Adjust Credit Limit
        </Button>
        <Button variant="destructive">
          <AlertCircle className="h-4 w-4 mr-2" />
          Suspend Account
        </Button>
      </div>
    </div>
  );
}
