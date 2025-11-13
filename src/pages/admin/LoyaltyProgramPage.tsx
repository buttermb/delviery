// @ts-nocheck
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Gift,
  TrendingUp,
  Users,
  Award,
  Plus,
  Settings,
  Trophy,
  Star,
  Zap,
} from "lucide-react";
import { logger } from "@/lib/logger";

export default function LoyaltyProgramPage() {
  const { tenant } = useTenantAdminAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch loyalty config
  const { data: config } = useQuery({
    queryKey: ["loyalty-config", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_program_config")
        .select("*")
        .eq("tenant_id", tenant?.id)
        .single();

      if (error && error.code !== "42P01") {
        logger.error("Failed to fetch loyalty config", error, { component: "LoyaltyProgramPage" });
      }

      return data || null;
    },
    enabled: !!tenant?.id,
  });

  // Fetch loyalty tiers
  const { data: tiers } = useQuery({
    queryKey: ["loyalty-tiers", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_tiers")
        .select("*")
        .eq("tenant_id", tenant?.id)
        .order("order_index");

      if (error && error.code !== "42P01") {
        logger.error("Failed to fetch loyalty tiers", error, { component: "LoyaltyProgramPage" });
      }

      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch loyalty rewards
  const { data: rewards } = useQuery({
    queryKey: ["loyalty-rewards", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("tenant_id", tenant?.id)
        .order("points_cost");

      if (error && error.code !== "42P01") {
        logger.error("Failed to fetch loyalty rewards", error, { component: "LoyaltyProgramPage" });
      }

      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch loyalty stats
  const { data: stats } = useQuery({
    queryKey: ["loyalty-stats", tenant?.id],
    queryFn: async () => {
      try {
        const { data: pointsData } = await supabase
          .from("customer_loyalty_points")
          .select("total_points, lifetime_points")
          .eq("tenant_id", tenant?.id);

        const { data: redemptionsData } = await supabase
          .from("loyalty_reward_redemptions")
          .select("points_spent")
          .eq("tenant_id", tenant?.id);

        const totalCustomers = pointsData?.length || 0;
        const totalPointsAwarded = pointsData?.reduce((sum, p) => sum + (p.lifetime_points || 0), 0) || 0;
        const totalPointsRedeemed = redemptionsData?.reduce((sum, r) => sum + (r.points_spent || 0), 0) || 0;
        const activePointsBalance = pointsData?.reduce((sum, p) => sum + (p.total_points || 0), 0) || 0;

        return {
          totalCustomers,
          totalPointsAwarded,
          totalPointsRedeemed,
          activePointsBalance,
          redemptionRate: totalPointsAwarded > 0 ? (totalPointsRedeemed / totalPointsAwarded) * 100 : 0,
        };
      } catch (error) {
        logger.error("Failed to fetch loyalty stats", error, { component: "LoyaltyProgramPage" });
        return {
          totalCustomers: 0,
          totalPointsAwarded: 0,
          totalPointsRedeemed: 0,
          activePointsBalance: 0,
          redemptionRate: 0,
        };
      }
    },
    enabled: !!tenant?.id,
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-8 w-8 text-emerald-500" />
            {config?.program_name || "Loyalty Program"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reward customers and drive repeat purchases
          </p>
        </div>
        <Button className="bg-emerald-500 hover:bg-emerald-600">
          <Settings className="h-4 w-4 mr-2" />
          Configure Program
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">Enrolled customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Points Awarded</CardTitle>
            <Star className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.totalPointsAwarded || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Points Redeemed</CardTitle>
            <Gift className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.totalPointsRedeemed || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.redemptionRate?.toFixed(1)}% redemption rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Balance</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.activePointsBalance || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Available to redeem</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Program Configuration</CardTitle>
              <CardDescription>Current loyalty program settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Points per Dollar</div>
                  <div className="text-2xl font-bold">{config?.points_per_dollar || 0}x</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Points to Dollar Ratio</div>
                  <div className="text-2xl font-bold">
                    ${(config?.points_to_dollar_ratio || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Signup Bonus</div>
                  <div className="text-2xl font-bold">{config?.signup_bonus_points || 0} pts</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Birthday Bonus</div>
                  <div className="text-2xl font-bold">{config?.birthday_bonus_points || 0} pts</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Program Status</span>
                  <Badge variant={config?.is_active ? "default" : "secondary"}>
                    {config?.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-medium">Tier System</span>
                  <Badge variant={config?.tier_enabled ? "default" : "secondary"}>
                    {config?.tier_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Loyalty Tiers</h3>
              <p className="text-sm text-muted-foreground">
                {tiers?.length || 0} tier(s) configured
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Tier
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiers?.map((tier) => (
              <Card key={tier.id} className="relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: tier.color }}
                />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>{tier.icon}</span>
                    {tier.name}
                    <Badge variant="outline" className="ml-auto">
                      {tier.multiplier}x points
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {tier.min_points?.toLocaleString()} -{" "}
                    {tier.max_points ? tier.max_points.toLocaleString() : "∞"} points
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <div className="font-medium mb-2">Benefits:</div>
                    <ul className="space-y-1">
                      {(tier.benefits as string[])?.map((benefit, i) => (
                        <li key={i} className="flex items-center gap-2 text-muted-foreground">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Rewards Catalog</h3>
              <p className="text-sm text-muted-foreground">
                {rewards?.length || 0} reward(s) available
              </p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Reward
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards?.map((reward) => (
              <Card key={reward.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{reward.name}</CardTitle>
                    <Badge variant={reward.is_active ? "default" : "secondary"}>
                      {reward.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {reward.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cost</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {reward.points_cost} pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline">
                        {reward.reward_type?.replace("_", " ")}
                      </Badge>
                    </div>
                    {reward.redemption_count > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Redeemed {reward.redemption_count} time(s)
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
