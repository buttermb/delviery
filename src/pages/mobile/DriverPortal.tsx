import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { humanizeError } from "@/lib/humanizeError";
import {
  Package,
  DollarSign,
  Scan,
  ArrowLeft,
  CheckCircle,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

export default function DriverPortal() {
  const navigate = useNavigate();
  const [_loading, setLoading] = useState(true);
  const [myFronts, setMyFronts] = useState<Array<{
    id: string;
    quantity_fronted: number;
    quantity_sold: number;
    quantity_returned: number;
    expected_revenue: string | number;
    payment_received: string | number;
    dispatched_at: string;
    tenants?: { slug: string };
    products?: { name: string };
    [key: string]: unknown;
  }>>([]);
  const [stats, setStats] = useState({
    totalUnits: 0,
    unitsSold: 0,
    totalOwed: 0,
    nearestDueDate: null as Date | null,
  });

  useEffect(() => {
    loadDriverData();
    subscribeToUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribeToUpdates and loadDriverData are defined below; only run once on mount
  }, []);

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel("driver-fronts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fronted_inventory",
        },
        () => loadDriverData()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Successfully subscribed to driver fronts');
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Failed to subscribe to driver fronts updates:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadDriverData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in");
        return;
      }

      // Get fronts for this driver
      const { data: fronts, error } = await supabase
        .from("fronted_inventory")
        .select(`
          *,
          products (name, sku, wholesale_price),
          tenants:account_id (slug)
        `)
        .eq("fronted_to_user_id", user.id)
        .eq("status", "active")
        .order("dispatched_at", { ascending: false });

      if (error) throw error;

      setMyFronts(fronts ?? []);

      // Calculate stats
      const totalUnits = fronts?.reduce((sum, f) => sum + f.quantity_fronted, 0) ?? 0;
      const unitsSold = fronts?.reduce((sum, f) => sum + f.quantity_sold, 0) ?? 0;
      const totalOwed = fronts?.reduce(
        (sum, f) => sum + (parseFloat(String(f.expected_revenue ?? 0)) - parseFloat(String(f.payment_received ?? 0))),
        0
      ) ?? 0;

      const dueDates = fronts
        ?.filter((f) => f.payment_due_date)
        .map((f) => new Date(f.payment_due_date))
        .sort((a, b) => a.getTime() - b.getTime());

      const nearestDueDate = dueDates && dueDates.length > 0 ? dueDates[0] : null;

      setStats({
        totalUnits,
        unitsSold,
        totalOwed,
        nearestDueDate,
      });
    } catch (error: unknown) {
      toast.error(humanizeError(error, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  const unitsRemaining = stats.totalUnits - stats.unitsSold;
  const soldPercentage = stats.totalUnits > 0 ? (stats.unitsSold / stats.totalUnits) * 100 : 0;

  const daysUntilDue = stats.nearestDueDate
    ? Math.ceil((stats.nearestDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-dvh bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to home">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Driver Portal</h1>
            <p className="text-sm text-muted-foreground">Your fronted inventory</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-4">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{unitsRemaining}</p>
                  <p className="text-xs text-muted-foreground">Units Left</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">${stats.totalOwed.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Owed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sales Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Sold</span>
                <span className="font-medium">
                  {stats.unitsSold} / {stats.totalUnits} units ({soldPercentage.toFixed(0)}%)
                </span>
              </div>
              <Progress value={soldPercentage} className="h-3" />
            </div>

            {daysUntilDue !== null && (
              <div
                className={`flex items-center gap-2 text-sm ${daysUntilDue < 0
                    ? "text-red-500"
                    : daysUntilDue < 7
                      ? "text-yellow-500"
                      : "text-green-500"
                  }`}
              >
                <Calendar className="h-4 w-4" />
                {daysUntilDue < 0 ? (
                  <span className="font-medium">Payment {Math.abs(daysUntilDue)} days overdue!</span>
                ) : (
                  <span>Payment due in {daysUntilDue} days</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-20 flex-col gap-2"
            onClick={() => {
              if (myFronts.length > 0) {
                const slug = myFronts[0].tenants?.slug;
                if (slug) {
                  navigate(`/${slug}/admin/inventory/fronted/${myFronts[0].id}/sale`);
                } else {
                  toast.error("Tenant information missing");
                }
              } else {
                toast.error("No active fronts");
              }
            }}
          >
            <Scan className="h-6 w-6" />
            <span>Record Sale</span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-20 flex-col gap-2"
            onClick={() => {
              if (myFronts.length > 0) {
                const slug = myFronts[0].tenants?.slug;
                if (slug) {
                  navigate(`/${slug}/admin/inventory/fronted/${myFronts[0].id}/return`);
                } else {
                  toast.error("Tenant information missing");
                }
              } else {
                toast.error("No active fronts");
              }
            }}
          >
            <Package className="h-6 w-6" />
            <span>Scan Returns</span>
          </Button>
        </div>

        {/* Active Fronts */}
        <div className="space-y-3">
          <h2 className="font-semibold">Your Active Inventory</h2>

          {myFronts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No active fronted inventory</p>
              </CardContent>
            </Card>
          ) : (
            myFronts.map((front) => {
              const remaining = front.quantity_fronted - front.quantity_sold - front.quantity_returned;
              const progress = (front.quantity_sold / front.quantity_fronted) * 100;
              const amountOwed = parseFloat(String(front.expected_revenue ?? 0)) - parseFloat(String(front.payment_received ?? 0));

              return (
                <Card
                  key={front.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    if (front.tenants?.slug) {
                      navigate(`/${front.tenants.slug}/admin/inventory/fronted/${front.id}`);
                    }
                  }}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{front.products?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Dispatched: {format(new Date(front.dispatched_at), "MMM dd")}
                        </p>
                      </div>
                      <Badge variant={remaining > 0 ? "default" : "secondary"}>
                        {remaining} left
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {front.quantity_sold}/{front.quantity_fronted} sold
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount Owed</p>
                        <p className="text-lg font-bold text-red-500">
                          ${amountOwed.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Due Date</p>
                        <p className="text-sm font-medium">
                          {front.payment_due_date
                            ? format(new Date(String(front.payment_due_date)), "MMM dd")
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (front.tenants?.slug) {
                            navigate(`/${front.tenants.slug}/admin/inventory/fronted/${front.id}/sale`);
                          }
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Record Sale
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (front.tenants?.slug) {
                            navigate(`/${front.tenants.slug}/admin/inventory/fronted/${front.id}`);
                          }
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Tips */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <TrendingUp className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-sm">Quick Tip</p>
                <p className="text-xs text-muted-foreground">
                  Record sales immediately after each transaction to keep accurate records and know
                  exactly what you have left to sell.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
