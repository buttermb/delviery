import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, ArrowRightLeft, TrendingUp, Clock, Truck } from "lucide-react";
import { showInfoToast } from "@/utils/toastHelpers";

export default function WholesaleInventory() {
  const navigate = useNavigate();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  // Mock data
  const overview = {
    total_stock_lbs: 284,
    total_stock_kg: 129,
    total_value: 852000,
    avg_cost_per_lb: 3000
  };

  const warehouses = [
    {
      id: "1",
      name: "Warehouse A",
      location: "Brooklyn",
      capacity_lbs: 500,
      current_stock_lbs: 156,
      value: 468000,
      status: "good",
      inventory: [
        { strain: "Blue Dream", weight_lbs: 45, cost_per_lb: 2800, value: 126000, status: "good" },
        { strain: "Wedding Cake", weight_lbs: 32, cost_per_lb: 3000, value: 96000, status: "good" },
        { strain: "Gelato", weight_lbs: 28, cost_per_lb: 3100, value: 86800, status: "good" },
        { strain: "OG Kush", weight_lbs: 22, cost_per_lb: 2900, value: 63800, status: "low" },
        { strain: "Purple Punch", weight_lbs: 18, cost_per_lb: 3200, value: 57600, status: "low" },
        { strain: "Sundae Driver", weight_lbs: 11, cost_per_lb: 3400, value: 37400, status: "very_low" },
      ]
    },
    {
      id: "2",
      name: "Warehouse B",
      location: "Queens",
      capacity_lbs: 400,
      current_stock_lbs: 96,
      value: 288000,
      status: "good",
      inventory: [
        { strain: "Blue Dream", weight_lbs: 28, cost_per_lb: 2800, value: 78400, status: "good" },
        { strain: "Gelato", weight_lbs: 25, cost_per_lb: 3100, value: 77500, status: "good" },
        { strain: "Wedding Cake", weight_lbs: 20, cost_per_lb: 3000, value: 60000, status: "good" },
        { strain: "Various Mix", weight_lbs: 23, cost_per_lb: 3100, value: 71300, status: "good" },
      ]
    }
  ];

  const activeDeliveries = [
    { id: "1", runner: "Runner #3", weight_lbs: 12, destination: "Eastside Collective (Manhattan)", eta: "2:30pm" },
    { id: "2", runner: "Runner #1", weight_lbs: 8, destination: "Queens Network", eta: "4:15pm" },
    { id: "3", runner: "Runner #5", weight_lbs: 7, destination: "Bronx Connect", eta: "5:00pm" },
    { id: "4", runner: "Runner #2", weight_lbs: 5, destination: "Staten Island", eta: "6:30pm" },
  ];

  const topMovers = [
    { strain: "Blue Dream", lbs_moved: 124, revenue: 347000, profit: 112000 },
    { strain: "Wedding Cake", lbs_moved: 98, revenue: 294000, profit: 98000 },
    { strain: "Gelato", lbs_moved: 87, revenue: 270000, profit: 89000 },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      good: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      low: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      very_low: "bg-destructive/10 text-destructive border-destructive/20"
    };
    return colors[status] || "";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      good: "🟢 Stock",
      low: "🟡 Low",
      very_low: "🔴 Very Low"
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">📦 Inventory Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Wholesale scale inventory tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Move Stock
          </Button>
          <Button className="bg-emerald-500 hover:bg-emerald-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Stock
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Stock</div>
          <div className="text-2xl font-bold">{overview.total_stock_lbs} lbs</div>
          <div className="text-xs text-muted-foreground">{overview.total_stock_kg} kg</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Total Value</div>
          <div className="text-2xl font-bold">${(overview.total_value / 1000).toFixed(0)}k</div>
          <div className="text-xs text-muted-foreground">at cost</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Avg Cost/lb</div>
          <div className="text-2xl font-bold">${overview.avg_cost_per_lb.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">average</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Warehouses</div>
          <div className="text-2xl font-bold">{warehouses.length}</div>
          <div className="text-xs text-emerald-500">All operational</div>
        </Card>
      </div>

      {/* Warehouses */}
      {warehouses.map((warehouse) => (
        <Card key={warehouse.id} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                🏢 {warehouse.name} - {warehouse.location}
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                  🟢 GOOD
                </Badge>
              </h2>
              <div className="text-sm text-muted-foreground mt-1">
                Capacity: {warehouse.capacity_lbs} lbs | Current: {warehouse.current_stock_lbs} lbs ({Math.round((warehouse.current_stock_lbs / warehouse.capacity_lbs) * 100)}%) | Value: ${(warehouse.value / 1000).toFixed(0)}k
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Move Stock</Button>
              <Button variant="outline" size="sm">Adjust Count</Button>
              <Button variant="outline" size="sm">View Details</Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strain</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Cost/lb</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouse.inventory.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{item.strain}</TableCell>
                  <TableCell>{item.weight_lbs} lbs</TableCell>
                  <TableCell className="font-mono">${item.cost_per_lb.toLocaleString()}</TableCell>
                  <TableCell className="font-mono">${item.value.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {getStatusLabel(item.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}

      {/* On Runners */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🚗 On Runners (In Transit)
            <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              🟡 TRACK
            </Badge>
          </h2>
          <div className="text-sm text-muted-foreground">
            Active Deliveries: {activeDeliveries.length} | Current: 32 lbs | Value: $96k
          </div>
        </div>

        <div className="space-y-3">
          {activeDeliveries.map((delivery) => (
            <div key={delivery.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-emerald-500" />
                <div>
                  <div className="font-medium">{delivery.runner}: {delivery.weight_lbs} lbs to {delivery.destination}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    ETA {delivery.eta}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/fleet-management')}
          >
            Track Live
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => showInfoToast("Calling Runners", "Calling all active runners")}
          >
            Call Runners
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/admin/delivery-management')}
          >
            Delivery Log
          </Button>
        </div>
      </Card>

      {/* Analytics */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Inventory Analytics
        </h2>

        <div className="mb-6">
          <h3 className="font-semibold mb-3">Top Movers (This Month)</h3>
          <div className="space-y-3">
            {topMovers.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <div className="font-medium">{idx + 1}. {item.strain} - {item.lbs_moved} lbs moved</div>
                  <div className="text-sm text-muted-foreground">
                    ${(item.revenue / 1000).toFixed(0)}k revenue, ${(item.profit / 1000).toFixed(0)}k profit
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">Restock Alerts</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-destructive">🔴</span>
              <span>Sundae Driver: Only 11 lbs left (restock by Dec 5)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-500">🟡</span>
              <span>OG Kush: 22 lbs left (will need more in 10 days)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-yellow-500">🟡</span>
              <span>Purple Punch: 18 lbs left (restock by Dec 8)</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button className="bg-emerald-500 hover:bg-emerald-600" size="sm">
            Generate Restock Order
          </Button>
          <Button variant="outline" size="sm">Contact Supplier</Button>
          <Button variant="outline" size="sm">View Trends</Button>
        </div>
      </Card>
    </div>
  );
}
