import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, BarChart3, TrendingUp, DollarSign } from "lucide-react";

const templates = [
  {
    id: "sales-summary",
    name: "Sales Summary",
    description: "Overview of sales performance, revenue, and trends",
    icon: DollarSign,
  },
  {
    id: "inventory-status",
    name: "Inventory Status",
    description: "Current inventory levels, stock alerts, and movements",
    icon: BarChart3,
  },
  {
    id: "customer-analysis",
    name: "Customer Analysis",
    description: "Customer segments, lifetime value, and retention metrics",
    icon: TrendingUp,
  },
  {
    id: "financial-dashboard",
    name: "Financial Dashboard",
    description: "Revenue, expenses, profit margins, and cash flow",
    icon: LayoutDashboard,
  },
];

export function ReportTemplates() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((template) => (
        <Card key={template.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <template.icon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{template.name}</CardTitle>
            </div>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full min-h-[44px] touch-manipulation">
              Use Template
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

