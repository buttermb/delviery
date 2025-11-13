import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Star,
  Gift,
  TrendingUp,
  Settings,
  Plus,
  Edit,
  Trash2,
  Loader2,
  DollarSign,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EarningRulesConfig } from "@/components/admin/loyalty/EarningRulesConfig";
import { RewardCatalog } from "@/components/admin/loyalty/RewardCatalog";
import { PointAdjustments } from "@/components/admin/loyalty/PointAdjustments";
import { LoyaltyAnalytics } from "@/components/admin/loyalty/LoyaltyAnalytics";
import { queryKeys } from "@/lib/queryKeys";
import { logger } from "@/lib/logger";

export default function LoyaltyProgramPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("rules");

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            ⭐ Loyalty Program
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Configure earning rules, manage rewards, and track customer loyalty
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rules" className="min-h-[44px] touch-manipulation">
            <Settings className="h-4 w-4 mr-2" />
            Earning Rules
          </TabsTrigger>
          <TabsTrigger value="rewards" className="min-h-[44px] touch-manipulation">
            <Gift className="h-4 w-4 mr-2" />
            Reward Catalog
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="min-h-[44px] touch-manipulation">
            <Star className="h-4 w-4 mr-2" />
            Point Adjustments
          </TabsTrigger>
          <TabsTrigger value="analytics" className="min-h-[44px] touch-manipulation">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <EarningRulesConfig />
        </TabsContent>

        <TabsContent value="rewards" className="space-y-4">
          <RewardCatalog />
        </TabsContent>

        <TabsContent value="adjustments" className="space-y-4">
          <PointAdjustments />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <LoyaltyAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}

