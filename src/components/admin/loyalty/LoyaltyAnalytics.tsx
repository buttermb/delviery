import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";

export function LoyaltyAnalytics() {
  const { tenant } = useTenantAdminAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.loyalty.analytics(),
    queryFn: async () => {
      if (!tenant?.id) return null;

      try {
        // Get total customers with points
        const { data: customers } = await supabase
          .from("customers")
          .select("loyalty_points, loyalty_tier")
          .eq("tenant_id", tenant.id);

        if (!customers) return null;

        const totalPoints = customers.reduce(
          (sum, c) => sum + (c.loyalty_points || 0),
          0
        );
        const activeMembers = customers.filter((c) => (c.loyalty_points || 0) > 0).length;
        const bronzeMembers = customers.filter((c) => c.loyalty_tier === "bronze").length;
        const silverMembers = customers.filter((c) => c.loyalty_tier === "silver").length;
        const goldMembers = customers.filter((c) => c.loyalty_tier === "gold").length;

        // Get redemption stats
        const { data: redemptions } = await supabase
          .from("reward_redemptions")
          .select("points_used")
          .eq("account_id", tenant.id);

        const totalRedemptions = redemptions?.length || 0;
        const totalPointsRedeemed =
          redemptions?.reduce((sum, r) => sum + (r.points_used || 0), 0) || 0;

        return {
          totalPoints,
          activeMembers,
          bronzeMembers,
          silverMembers,
          goldMembers,
          totalRedemptions,
          totalPointsRedeemed,
        };
      } catch {
        return null;
      }
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Points Outstanding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.totalPoints.toLocaleString() || 0}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Active Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.activeMembers || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalRedemptions || 0}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {stats?.totalPointsRedeemed.toLocaleString() || 0} points redeemed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Bronze Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.bronzeMembers || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Silver Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.silverMembers || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Gold Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.goldMembers || 0}</div>
        </CardContent>
      </Card>
    </div>
  );
}

