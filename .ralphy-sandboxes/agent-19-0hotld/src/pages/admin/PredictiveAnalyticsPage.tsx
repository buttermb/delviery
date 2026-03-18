import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  Package,
  DollarSign,
} from "lucide-react";
import { DemandForecast } from "@/components/admin/predictive/DemandForecast";
import { InventoryOptimization } from "@/components/admin/predictive/InventoryOptimization";
import { CashFlowProjection } from "@/components/admin/predictive/CashFlowProjection";

export default function PredictiveAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("demand");

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Predictive Analytics & Forecasting
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            AI-powered demand forecasting, inventory optimization, and cash flow projections
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="demand" className="min-h-[44px] touch-manipulation">
            <TrendingUp className="h-4 w-4 mr-2" />
            Demand Forecast
          </TabsTrigger>
          <TabsTrigger value="inventory" className="min-h-[44px] touch-manipulation">
            <Package className="h-4 w-4 mr-2" />
            Inventory Optimization
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="min-h-[44px] touch-manipulation">
            <DollarSign className="h-4 w-4 mr-2" />
            Cash Flow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="demand" className="space-y-4">
          <DemandForecast />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <InventoryOptimization />
        </TabsContent>

        <TabsContent value="cashflow" className="space-y-4">
          <CashFlowProjection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

