import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Users from "lucide-react/dist/esm/icons/users";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  total_spent: number;
  lifecycle: string;
  segment: string;
}

interface CustomerSegmentationProps {
  customers: Customer[];
}

export function CustomerSegmentation({ customers }: CustomerSegmentationProps) {
  const segments = {
    champions: customers.filter((c) => c.segment === "champions"),
    "high-value": customers.filter((c) => c.segment === "high-value"),
    "bulk-buyers": customers.filter((c) => c.segment === "bulk-buyers"),
    "at-risk": customers.filter((c) => c.segment === "at-risk"),
    new: customers.filter((c) => c.segment === "new"),
    regular: customers.filter((c) => c.segment === "regular"),
  };

  const segmentStats = Object.entries(segments).map(([key, customers]) => ({
    name: key,
    count: customers.length,
    totalValue: customers.reduce((sum, c) => sum + c.total_spent, 0),
    avgValue: customers.length > 0
      ? customers.reduce((sum, c) => sum + c.total_spent, 0) / customers.length
      : 0,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {segmentStats.map((stat) => (
        <Card key={stat.name}>
          <CardHeader>
            <CardTitle className="text-sm font-medium capitalize">
              {stat.name.replace("-", " ")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{stat.count}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-medium">
                  ${stat.totalValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Avg: ${stat.avgValue.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

