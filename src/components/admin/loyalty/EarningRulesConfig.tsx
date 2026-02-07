import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export function EarningRulesConfig() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [rules, setRules] = useState({
    points_per_dollar: 1,
    bonus_points_enabled: false,
    bonus_points_multiplier: 2,
    birthday_bonus: 0,
    anniversary_bonus: 0,
    tier_bronze_multiplier: 1,
    tier_silver_multiplier: 1.5,
    tier_gold_multiplier: 2,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof rules) => {
      // Store in tenant settings or a loyalty_config table
      // For now, we'll use a simple approach with tenant metadata
      if (!tenant?.id) throw new Error("Tenant ID required");

      const { error } = await supabase
        .from("tenants")
        .update({
          features: {
            ...tenant.features,
            loyalty_config: data,
          },
        })
        .eq("id", tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Earning rules updated successfully");
    },
    onError: (error: unknown) => {
      logger.error('Failed to update earning rules', error, { component: 'EarningRulesConfig' });
      toast.error("Failed to update earning rules");
    },
  });

  const handleSave = async () => {
    await updateMutation.mutateAsync(rules);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Earning Rules Configuration</CardTitle>
        <CardDescription>
          Configure how customers earn loyalty points
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="points_per_dollar">Points per Dollar Spent</Label>
            <Input
              id="points_per_dollar"
              type="number"
              min="0"
              step="0.1"
              value={rules.points_per_dollar}
              onChange={(e) =>
                setRules({ ...rules, points_per_dollar: parseFloat(e.target.value) || 0 })
              }
              className="min-h-[44px] touch-manipulation"
            />
            <p className="text-sm text-muted-foreground">
              Customers earn this many points for every dollar spent
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Bonus Points</Label>
              <p className="text-sm text-muted-foreground">
                Award bonus points for specific products or categories
              </p>
            </div>
            <Switch
              checked={rules.bonus_points_enabled}
              onCheckedChange={(checked) =>
                setRules({ ...rules, bonus_points_enabled: checked })
              }
            />
          </div>

          {rules.bonus_points_enabled && (
            <div className="space-y-2 pl-6 border-l-2">
              <Label htmlFor="bonus_multiplier">Bonus Points Multiplier</Label>
              <Input
                id="bonus_multiplier"
                type="number"
                min="1"
                step="0.1"
                value={rules.bonus_points_multiplier}
                onChange={(e) =>
                  setRules({ ...rules, bonus_points_multiplier: parseFloat(e.target.value) || 1 })
                }
                className="min-h-[44px] touch-manipulation"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="birthday_bonus">Birthday Bonus Points</Label>
            <Input
              id="birthday_bonus"
              type="number"
              min="0"
              value={rules.birthday_bonus}
              onChange={(e) =>
                setRules({ ...rules, birthday_bonus: parseInt(e.target.value) || 0 })
              }
              className="min-h-[44px] touch-manipulation"
            />
            <p className="text-sm text-muted-foreground">
              Points awarded on customer's birthday
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="anniversary_bonus">Anniversary Bonus Points</Label>
            <Input
              id="anniversary_bonus"
              type="number"
              min="0"
              value={rules.anniversary_bonus}
              onChange={(e) =>
                setRules({ ...rules, anniversary_bonus: parseInt(e.target.value) || 0 })
              }
              className="min-h-[44px] touch-manipulation"
            />
            <p className="text-sm text-muted-foreground">
              Points awarded on customer's account anniversary
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">Tier-Based Multipliers</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bronze_multiplier">Bronze Multiplier</Label>
                <Input
                  id="bronze_multiplier"
                  type="number"
                  min="1"
                  step="0.1"
                  value={rules.tier_bronze_multiplier}
                  onChange={(e) =>
                    setRules({ ...rules, tier_bronze_multiplier: parseFloat(e.target.value) || 1 })
                  }
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="silver_multiplier">Silver Multiplier</Label>
                <Input
                  id="silver_multiplier"
                  type="number"
                  min="1"
                  step="0.1"
                  value={rules.tier_silver_multiplier}
                  onChange={(e) =>
                    setRules({ ...rules, tier_silver_multiplier: parseFloat(e.target.value) || 1 })
                  }
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gold_multiplier">Gold Multiplier</Label>
                <Input
                  id="gold_multiplier"
                  type="number"
                  min="1"
                  step="0.1"
                  value={rules.tier_gold_multiplier}
                  onChange={(e) =>
                    setRules({ ...rules, tier_gold_multiplier: parseFloat(e.target.value) || 1 })
                  }
                  className="min-h-[44px] touch-manipulation"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="min-h-[44px] touch-manipulation"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Rules
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

