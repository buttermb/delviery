import { useState } from "react";
import { logger } from '@/lib/logger';
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
  Plus,
  Settings,
  Trophy,
  Star,
  Zap,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { humanizeError } from '@/lib/humanizeError';
import { handleError } from '@/utils/errorHandling/handlers';
import { queryKeys } from '@/lib/queryKeys';

interface LoyaltyConfig {
  program_name?: string;
  points_per_dollar?: number;
  points_to_dollar_ratio?: number;
  signup_bonus_points?: number;
  birthday_bonus_points?: number;
  is_active?: boolean;
  tier_enabled?: boolean;
}

interface LoyaltyTier {
  id: string;
  name: string;
  color: string;
  icon?: string;
  multiplier: number;
  min_points: number;
  max_points?: number;
  benefits?: string[];
}

interface LoyaltyReward {
  id: string;
  reward_name: string;
  reward_description?: string;
  points_required: number;
  reward_type: string;
  is_active: boolean;
  redemption_count?: number;
}

interface CustomerLoyaltyPoints {
  total_points: number;
  lifetime_points: number;
}

interface LoyaltyRewardRedemption {
  points_spent: number;
}

interface _LoyaltyStats {
  total_members: number;
  points_issued: number;
  points_redeemed: number;
  active_rewards: number;
}

export default function LoyaltyProgramPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const { dialogState, confirm, closeDialog, setLoading: setDialogLoading } = useConfirmDialog();

  // Dialog States
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTierOpen, setIsTierOpen] = useState(false);
  const [isRewardOpen, setIsRewardOpen] = useState(false);

  // Editing States
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const [editingReward, setEditingReward] = useState<LoyaltyReward | null>(null);

  // Form States
  const [configForm, setConfigForm] = useState<LoyaltyConfig>({});
  const [tierForm, setTierForm] = useState<Partial<LoyaltyTier>>({
    name: "",
    color: "#000000",
    multiplier: 1,
    min_points: 0,
    benefits: [],
  });
  const [rewardForm, setRewardForm] = useState<Partial<LoyaltyReward>>({
    reward_name: "",
    reward_description: "",
    points_required: 100,
    reward_type: "discount",
    is_active: true,
  });

  // Mutations
  const updateConfigMutation = useMutation({
    mutationFn: async (data: LoyaltyConfig) => {
      const { error } = await supabase
        .from("loyalty_program_config")
        .upsert({ ...data, tenant_id: tenant?.id })
        .select();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loyaltyProgram.allConfig });
      toast.success('Program configuration saved');
      setIsConfigOpen(false);
    },
    onError: (error) => {
      toast.error(humanizeError(error));
    },
  });

  const upsertTierMutation = useMutation({
    mutationFn: async (data: Partial<LoyaltyTier>) => {
      const { error } = await supabase
        .from("loyalty_tiers")
        .upsert({ ...data, tenant_id: tenant?.id })
        .select();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loyaltyProgram.allTiers });
      toast.success('Tier saved successfully');
      setTierForm({ name: "", color: "#000000", multiplier: 1, min_points: 0, benefits: [] });
      setEditingTier(null);
      setIsTierOpen(false);
    },
    onError: (error) => {
      toast.error(humanizeError(error));
    },
  });

  const upsertRewardMutation = useMutation({
    mutationFn: async (data: Partial<LoyaltyReward>) => {
      const { error } = await supabase
        .from("loyalty_rewards")
        .upsert({ ...data, tenant_id: tenant?.id })
        .select();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loyaltyProgram.allRewards });
      toast.success('Reward saved successfully');
      setRewardForm({ reward_name: "", reward_description: "", points_required: 100, reward_type: "discount", is_active: true });
      setEditingReward(null);
      setIsRewardOpen(false);
    },
    onError: (error) => {
      toast.error(humanizeError(error));
    },
  });

  const deleteTierMutation = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("loyalty_tiers").delete().eq("id", id).eq("tenant_id", tenant?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loyaltyProgram.allTiers });
      toast.success('Tier deleted');
    },
    onError: (error) => {
      handleError(error, {
        component: 'LoyaltyProgram.deleteTier',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const deleteRewardMutation = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("loyalty_rewards").delete().eq("id", id).eq("tenant_id", tenant?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loyaltyProgram.allRewards });
      toast.success('Reward deleted');
    },
    onError: (error) => {
      handleError(error, {
        component: 'LoyaltyProgram.deleteReward',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  // Handlers
  const handleOpenConfig = () => {
    if (config) setConfigForm(config);
    setIsConfigOpen(true);
  };

  const handleOpenTier = (tier?: LoyaltyTier) => {
    if (tier) {
      setEditingTier(tier);
      setTierForm(tier);
    } else {
      setEditingTier(null);
      setTierForm({ name: "", color: "#000000", multiplier: 1, min_points: 0, benefits: [] });
    }
    setIsTierOpen(true);
  };

  const handleOpenReward = (reward?: LoyaltyReward) => {
    if (reward) {
      setEditingReward(reward);
      setRewardForm(reward);
    } else {
      setEditingReward(null);
      setRewardForm({ reward_name: "", reward_description: "", points_required: 100, reward_type: "discount", is_active: true });
    }
    setIsRewardOpen(true);
  };

  // Fetch loyalty config
  const { data: config } = useQuery({
    queryKey: queryKeys.loyaltyProgram.config(tenant?.id),
    queryFn: async (): Promise<LoyaltyConfig | null> => {
      const { data, error } = await supabase
        .from("loyalty_program_config")
        .select("*")
        .eq("tenant_id", tenant?.id)
        .maybeSingle();

      if (error && error.code !== "42P01") {
        logger.error("Failed to fetch loyalty config", error, { component: "LoyaltyProgramPage" });
      }

      return (data as unknown as LoyaltyConfig) || null;
    },
    enabled: !!tenant?.id,
  });

  // Fetch loyalty tiers
  const { data: tiers } = useQuery({
    queryKey: queryKeys.loyaltyProgram.tiers(tenant?.id),
    queryFn: async (): Promise<LoyaltyTier[]> => {
      const { data, error } = await supabase
        .from("loyalty_tiers")
        .select("*")
        .eq("tenant_id", tenant?.id)
        .order("order_index");

      if (error && error.code !== "42P01") {
        logger.error("Failed to fetch loyalty tiers", error, { component: "LoyaltyProgramPage" });
      }

      return (data as unknown as LoyaltyTier[]) ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch loyalty rewards
  const { data: rewards } = useQuery<LoyaltyReward[]>({
    queryKey: queryKeys.loyaltyProgram.rewards(tenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_rewards")
        .select("*")
        .eq("tenant_id", tenant?.id)
        .order("points_required");

      if (error && error.code !== "42P01") {
        logger.error("Failed to fetch loyalty rewards", error, { component: "LoyaltyProgramPage" });
      }

      return (data as unknown as LoyaltyReward[]) ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch loyalty stats
  const { data: stats } = useQuery({
    queryKey: queryKeys.loyaltyProgram.stats(tenant?.id),
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

        const totalCustomers = pointsData?.length ?? 0;
        const totalPointsAwarded = (pointsData as unknown as CustomerLoyaltyPoints[])?.reduce((sum, p) => sum + (p.lifetime_points ?? 0), 0) ?? 0;
        const totalPointsRedeemed = (redemptionsData as unknown as LoyaltyRewardRedemption[])?.reduce((sum, r) => sum + (r.points_spent ?? 0), 0) ?? 0;
        const activePointsBalance = (pointsData as unknown as CustomerLoyaltyPoints[])?.reduce((sum, p) => sum + (p.total_points ?? 0), 0) ?? 0;

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
    <div className="space-y-4 p-4 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-8 w-8 text-emerald-500" />
            {config?.program_name || "Loyalty Program"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reward customers and drive repeat purchases
          </p>
        </div>
        <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleOpenConfig}>
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
            <div className="text-2xl font-bold">{stats?.totalCustomers ?? 0}</div>
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
              {(stats?.totalPointsAwarded ?? 0).toLocaleString()}
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
              {(stats?.totalPointsRedeemed ?? 0).toLocaleString()}
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
              {(stats?.activePointsBalance ?? 0).toLocaleString()}
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
                  <div className="text-2xl font-bold">{config?.points_per_dollar ?? 0}x</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Points to Dollar Ratio</div>
                  <div className="text-2xl font-bold">
                    ${(config?.points_to_dollar_ratio ?? 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Signup Bonus</div>
                  <div className="text-2xl font-bold">{config?.signup_bonus_points ?? 0} pts</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Birthday Bonus</div>
                  <div className="text-2xl font-bold">{config?.birthday_bonus_points ?? 0} pts</div>
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
                {tiers?.length ?? 0} tier(s) configured
              </p>
            </div>
            <Button onClick={() => handleOpenTier()}>
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
                  <div className="flex justify-between items-start">
                    <CardTitle className="flex items-center gap-2">
                      <span>{tier.icon}</span>
                      {tier.name}
                      <Badge variant="outline" className="ml-auto">
                        {tier.multiplier}x points
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenTier(tier)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          confirm({
                            title: 'Delete Tier?',
                            description: `Are you sure you want to delete the "${tier.name}" tier? This action cannot be undone.`,
                            itemName: tier.name,
                            itemType: 'tier',
                            onConfirm: async () => {
                              setDialogLoading(true);
                              try {
                                await deleteTierMutation.mutateAsync(tier.id);
                              } finally {
                                setDialogLoading(false);
                                closeDialog();
                              }
                            },
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {tier.min_points?.toLocaleString()} -{" "}
                    {tier.max_points ? tier.max_points.toLocaleString() : "∞"} points
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <div className="font-medium mb-2">Benefits:</div>
                    <ul className="space-y-1">
                      {tier.benefits?.map((benefit: string, i: number) => (
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
                {rewards?.length ?? 0} reward(s) available
              </p>
            </div>
            <Button onClick={() => handleOpenReward()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Reward
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards?.map((reward) => (
              <Card key={reward.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{reward.reward_name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={reward.is_active ? "default" : "secondary"}>
                        {reward.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenReward(reward)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          confirm({
                            title: 'Delete Reward?',
                            description: `Are you sure you want to delete the "${reward.reward_name}" reward? This action cannot be undone.`,
                            itemName: reward.reward_name,
                            itemType: 'reward',
                            onConfirm: async () => {
                              setDialogLoading(true);
                              try {
                                await deleteRewardMutation.mutateAsync(reward.id);
                              } finally {
                                setDialogLoading(false);
                                closeDialog();
                              }
                            },
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {reward.reward_description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Cost</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {reward.points_required} pts
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

      {/* Config Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Loyalty Program</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Program Name</Label>
              <Input
                value={configForm.program_name || ""}
                onChange={(e) => setConfigForm({ ...configForm, program_name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Points per Dollar</Label>
                <Input
                  type="number"
                  value={configForm.points_per_dollar ?? 0}
                  onChange={(e) => setConfigForm({ ...configForm, points_per_dollar: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Points Value ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={configForm.points_to_dollar_ratio ?? 0}
                  onChange={(e) => setConfigForm({ ...configForm, points_to_dollar_ratio: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Program Active</Label>
              <Switch
                checked={configForm.is_active}
                onCheckedChange={(c) => setConfigForm({ ...configForm, is_active: c })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>Cancel</Button>
            <Button disabled={updateConfigMutation.isPending} onClick={() => updateConfigMutation.mutate(configForm)}>
              {updateConfigMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tier Dialog */}
      <Dialog open={isTierOpen} onOpenChange={setIsTierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTier ? "Edit Tier" : "Add Tier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tier Name</Label>
              <Input
                value={tierForm.name || ""}
                onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Points</Label>
                <Input
                  type="number"
                  value={tierForm.min_points ?? 0}
                  onChange={(e) => setTierForm({ ...tierForm, min_points: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={tierForm.multiplier || 1}
                  onChange={(e) => setTierForm({ ...tierForm, multiplier: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  className="w-12 p-1"
                  value={tierForm.color || "#000000"}
                  onChange={(e) => setTierForm({ ...tierForm, color: e.target.value })}
                />
                <Input
                  value={tierForm.color || "#000000"}
                  onChange={(e) => setTierForm({ ...tierForm, color: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTierOpen(false)}>Cancel</Button>
            <Button disabled={upsertTierMutation.isPending} onClick={() => upsertTierMutation.mutate(tierForm)}>
              {upsertTierMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Tier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reward Dialog */}
      <Dialog open={isRewardOpen} onOpenChange={setIsRewardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingReward ? "Edit Reward" : "Add Reward"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reward Name</Label>
              <Input
                value={rewardForm.reward_name || ""}
                onChange={(e) => setRewardForm({ ...rewardForm, reward_name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={rewardForm.reward_description || ""}
                onChange={(e) => setRewardForm({ ...rewardForm, reward_description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reward-points-cost">Points Cost</Label>
                <Input
                  id="reward-points-cost"
                  type="number"
                  value={rewardForm.points_required ?? 0}
                  onChange={(e) => setRewardForm({ ...rewardForm, points_required: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reward-type">Type</Label>
                <Select value={rewardForm.reward_type} onValueChange={(v) => setRewardForm({ ...rewardForm, reward_type: v })}>
                  <SelectTrigger id="reward-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="free_item">Free Item</SelectItem>
                    <SelectItem value="cashback">Cashback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={rewardForm.is_active}
                onCheckedChange={(c) => setRewardForm({ ...rewardForm, is_active: c })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRewardOpen(false)}>Cancel</Button>
            <Button disabled={upsertRewardMutation.isPending} onClick={() => upsertRewardMutation.mutate(rewardForm)}>
              {upsertRewardMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={dialogState.open}
        onOpenChange={(open) => !open && closeDialog()}
        title={dialogState.title}
        description={dialogState.description}
        itemName={dialogState.itemName}
        itemType={dialogState.itemType}
        onConfirm={dialogState.onConfirm}
        isLoading={dialogState.isLoading}
      />
    </div >
  );
}
