import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp } from "lucide-react";

export function CashFlowProjection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cash Flow Projections</CardTitle>
          <CardDescription>
            Forecast future cash flow based on orders, payments, and expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Cash flow projections coming soon.</p>
            <p className="text-sm mt-2">
              Predict cash flow for the next 30, 60, and 90 days to plan for growth and expenses.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

