import { Card, CardContent } from "@/components/ui/card";
import { Package, DollarSign, TrendingUp, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CourierQuickStatsProps {
  todayDeliveries: number;
  todayEarned: number;
  avgDeliveryTime?: number;
  isLoading?: boolean;
}

export function CourierQuickStats({
  todayDeliveries,
  todayEarned,
  avgDeliveryTime,
  isLoading = false,
}: CourierQuickStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-12 mb-2" />
            <Skeleton className="h-4 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      icon: Package,
      label: "Today's Deliveries",
      value: todayDeliveries,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: DollarSign,
      label: "Today's Earnings",
      value: `$${todayEarned.toFixed(2)}`,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      icon: Clock,
      label: "Avg Time",
      value: avgDeliveryTime ? `${avgDeliveryTime}min` : "N/A",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      icon: TrendingUp,
      label: "Per Delivery",
      value: todayDeliveries > 0 ? `$${(todayEarned / todayDeliveries).toFixed(2)}` : "$0.00",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className="p-4">
          <CardContent className="p-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-600 mt-1">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

