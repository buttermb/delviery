import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Calendar,
  AlertTriangle,
  Download,
  BarChart3,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { format, subDays } from "date-fns";
import { handleError } from "@/utils/errorHandling/handlers";

export default function FrontedInventoryAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFronted: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalOwed: 0,
    activeFronts: 0,
    overdueFronts: 0,
    averageMargin: 0,
    totalUnits: 0,
  });
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get all fronted inventory
      const { data: fronts, error } = await supabase
        .from("fronted_inventory")
        .select(`
          *,
          products (name, category),
          fronted_payments (amount)
        `);

      if (error) {
        logger.error('Error loading fronted inventory:', error);
        toast.error(`Failed to load analytics: ${error.message}`);
        return;
      }

      if (!fronts || fronts.length === 0) {
        toast.error('No fronted inventory data found');
        setLoading(false);
        return;
      }

      // Calculate stats
      const totalFronted = fronts?.reduce(
        (sum, f) => sum + (parseFloat(String(f.expected_revenue || 0))),
        0
      ) || 0;

      const totalRevenue = fronts?.reduce(
        (sum, f) => sum + (parseFloat(String(f.payment_received || 0))),
        0
      ) || 0;

      const totalProfit = fronts?.reduce(
        (sum, f) => {
          const received = parseFloat(String(f.payment_received || 0));
          const cost = parseFloat(String(f.cost_per_unit || 0)) * f.quantity_fronted;
          return sum + Math.min(received, parseFloat(String(f.expected_revenue || 0))) - cost;
        },
        0
      ) || 0;

      const totalOwed = fronts?.reduce(
        (sum, f) => sum + (parseFloat(String(f.expected_revenue || 0)) - parseFloat(String(f.payment_received || 0))),
        0
      ) || 0;

      const activeFronts = fronts?.filter((f) => f.status === "active").length || 0;

      const overdueFronts = fronts?.filter(
        (f) =>
          f.status === "active" &&
          f.payment_due_date &&
          new Date(f.payment_due_date) < new Date() &&
          parseFloat(String(f.expected_revenue || 0)) > parseFloat(String(f.payment_received || 0))
      ).length || 0;

      const totalUnits = fronts?.reduce((sum, f) => sum + f.quantity_fronted, 0) || 0;

      const averageMargin =
        fronts && fronts.length > 0
          ? fronts.reduce(
            (sum, f) =>
              sum +
              (parseFloat(String(f.expected_profit || 0)) / parseFloat(String(f.expected_revenue || 1))) * 100,
            0
          ) / fronts.length
          : 0;

      setStats({
        totalFronted,
        totalRevenue,
        totalProfit,
        totalOwed,
        activeFronts,
        overdueFronts,
        averageMargin,
        totalUnits,
      });

      // Top performers by profit
      const performerMap = new Map();
      fronts?.forEach((front) => {
        const name = front.fronted_to_customer_name || "Unknown";
        const profit = parseFloat(String(front.expected_profit || 0));
        const revenue = parseFloat(String(front.expected_revenue || 0));

        if (!performerMap.has(name)) {
          performerMap.set(name, { name, profit: 0, revenue: 0, fronts: 0 });
        }

        const performer = performerMap.get(name);
        performer.profit += profit;
        performer.revenue += revenue;
        performer.fronts += 1;
      });

      const performers = Array.from(performerMap.values())
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

      setTopPerformers(performers);

      // Top products
      const productMap = new Map();
      fronts?.forEach((front) => {
        const productName = front.products?.name || "Unknown";
        const units = front.quantity_fronted;
        const revenue = parseFloat(String(front.expected_revenue || 0));

        if (!productMap.has(productName)) {
          productMap.set(productName, { name: productName, units: 0, revenue: 0, fronts: 0 });
        }

        const product = productMap.get(productName);
        product.units += units;
        product.revenue += revenue;
        product.fronts += 1;
      });

      const products = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setTopProducts(products);

      // Timeline data (last 30 days)
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return {
          date: format(date, "MMM dd"),
          fronted: 0,
          revenue: 0,
        };
      });

      fronts?.forEach((front) => {
        const frontDate = new Date(front.dispatched_at);
        const dayIndex = last30Days.findIndex(
          (d) => format(frontDate, "MMM dd") === d.date
        );
        if (dayIndex !== -1) {
          last30Days[dayIndex].fronted += parseFloat(String(front.expected_revenue || 0));
        }

        // Add revenue from payments
        front.fronted_payments?.forEach((payment: any) => {
          const paymentDate = new Date(payment.received_at);
          const dayIndex = last30Days.findIndex(
            (d) => format(paymentDate, "MMM dd") === d.date
          );
          if (dayIndex !== -1) {
            last30Days[dayIndex].revenue += parseFloat(String(payment.amount || 0));
          }
        });
      });

      setTimelineData(last30Days);
    } catch (error) {
      handleError(error, {
        component: 'FrontedInventoryAnalytics.loadAnalytics',
        toastTitle: 'Error',
        showToast: true
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    const csv = [
      ["Fronted Inventory Analytics Report"],
      ["Generated", new Date().toLocaleString()],
      [""],
      ["Overall Statistics"],
      ["Total Fronted", `$${stats.totalFronted.toFixed(2)}`],
      ["Total Revenue", `$${stats.totalRevenue.toFixed(2)}`],
      ["Total Profit", `$${stats.totalProfit.toFixed(2)}`],
      ["Total Owed", `$${stats.totalOwed.toFixed(2)}`],
      ["Active Fronts", stats.activeFronts],
      ["Overdue Fronts", stats.overdueFronts],
      ["Average Margin", `${stats.averageMargin.toFixed(1)}%`],
      ["Total Units", stats.totalUnits],
      [""],
      ["Top Performers"],
      ["Name", "Total Profit", "Total Revenue", "Number of Fronts"],
      ...topPerformers.map((p) => [
        p.name,
        `$${p.profit.toFixed(2)}`,
        `$${p.revenue.toFixed(2)}`,
        p.fronts,
      ]),
      [""],
      ["Top Products"],
      ["Product", "Units Fronted", "Revenue", "Number of Fronts"],
      ...topProducts.map((p) => [
        p.name,
        p.units,
        `$${p.revenue.toFixed(2)}`,
        p.fronts,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fronted-inventory-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Report exported");
  };

  if (loading) return <div className="p-6">Loading analytics...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fronted Inventory Analytics</h1>
          <p className="text-muted-foreground">Performance insights and metrics</p>
        </div>
        <Button onClick={exportReport}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Fronted</p>
                <p className="text-2xl font-bold">${stats.totalFronted.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(0)}</p>
                <p className="text-xs text-green-500">
                  {((stats.totalRevenue / stats.totalFronted) * 100 || 0).toFixed(1)}% collected
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Package className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Profit</p>
                <p className="text-2xl font-bold text-green-600">
                  ${stats.totalProfit.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.averageMargin.toFixed(1)}% avg margin
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Owed</p>
                <p className="text-2xl font-bold text-red-500">${stats.totalOwed.toFixed(0)}</p>
                <p className="text-xs text-red-500">{stats.overdueFronts} overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Fronts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.activeFronts}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Units Fronted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalUnits}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {((stats.totalRevenue / stats.totalFronted) * 100 || 0).toFixed(1)}%
            </p>
            <Progress
              value={(stats.totalRevenue / stats.totalFronted) * 100 || 0}
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Performers (By Profit)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Total Profit</TableHead>
                <TableHead>Total Revenue</TableHead>
                <TableHead>Fronts</TableHead>
                <TableHead>Avg per Front</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPerformers.map((performer, index) => (
                <TableRow key={performer.name}>
                  <TableCell>
                    <Badge variant={index < 3 ? "default" : "outline"}>#{index + 1}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{performer.name}</TableCell>
                  <TableCell className="text-green-600 font-bold">
                    ${performer.profit.toFixed(2)}
                  </TableCell>
                  <TableCell>${performer.revenue.toFixed(2)}</TableCell>
                  <TableCell>{performer.fronts}</TableCell>
                  <TableCell>
                    ${(performer.profit / performer.fronts).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Top Products (By Revenue)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Units Fronted</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Number of Fronts</TableHead>
                <TableHead>Avg Revenue per Front</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.map((product, index) => (
                <TableRow key={product.name}>
                  <TableCell>
                    <Badge variant={index < 3 ? "default" : "outline"}>#{index + 1}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.units} units</TableCell>
                  <TableCell className="font-bold">${product.revenue.toFixed(2)}</TableCell>
                  <TableCell>{product.fronts}</TableCell>
                  <TableCell>${(product.revenue / product.fronts).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Timeline Chart (Simple Text Visualization) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            30-Day Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {timelineData.slice(-7).map((day) => (
              <div key={day.date} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{day.date}</span>
                  <div className="flex gap-4">
                    <span className="text-blue-500">Fronted: ${day.fronted.toFixed(0)}</span>
                    <span className="text-green-500">Revenue: ${day.revenue.toFixed(0)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <div
                    className="h-2 bg-blue-500 rounded"
                    style={{
                      width: `${(day.fronted / Math.max(...timelineData.map((d) => d.fronted))) * 100}%`,
                    }}
                  />
                  <div
                    className="h-2 bg-green-500 rounded"
                    style={{
                      width: `${(day.revenue / Math.max(...timelineData.map((d) => d.revenue))) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
