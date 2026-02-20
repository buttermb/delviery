import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Loader2, Gift } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryKeys } from "@/lib/queryKeys";
import { ADMIN_PANEL_QUERY_CONFIG } from '@/lib/react-query-config';
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";

interface Reward {
  id?: string;
  reward_name: string;
  reward_description?: string;
  points_required: number;
  reward_type: "discount" | "free_product" | "free_delivery" | "other";
  reward_value?: string;
  is_active: boolean;
}

export function RewardCatalog() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [formData, setFormData] = useState<Reward>({
    reward_name: "",
    reward_description: "",
    points_required: 100,
    reward_type: "discount",
    reward_value: "",
    is_active: true,
  });
  const { dialogState, confirm, closeDialog, setLoading } = useConfirmDialog();

  const { data: rewards, isLoading } = useQuery({
    queryKey: queryKeys.loyalty.rewards(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("loyalty_rewards")
          .select("*")
          .eq("account_id", tenant.id)
          .order("points_required", { ascending: true });

        if (error && error.code !== "42P01") {
          logger.error('Failed to fetch rewards', error, { component: 'RewardCatalog' });
          return [];
        }

        return (data || []) as Reward[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
    ...ADMIN_PANEL_QUERY_CONFIG,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Reward) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      const { error } = await supabase.from("loyalty_rewards").insert([
        {
          account_id: tenant.id,
          ...data,
        },
      ]);

      if (error && error.code !== "42P01") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.rewards() });
      toast.success("Reward created successfully");
      setIsFormOpen(false);
      setFormData({
        reward_name: "",
        reward_description: "",
        points_required: 100,
        reward_type: "discount",
        reward_value: "",
        is_active: true,
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to create reward', error, { component: 'RewardCatalog' });
      toast.error("Failed to create reward");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loyalty_rewards").delete().eq("id", id);
      if (error && error.code !== "42P01") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.loyalty.rewards() });
      toast.success("Reward deleted successfully");
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete reward', error, { component: 'RewardCatalog' });
      toast.error("Failed to delete reward");
    },
  });

  const handleCreate = () => {
    setEditingReward(null);
    setFormData({
      reward_name: "",
      reward_description: "",
      points_required: 100,
      reward_type: "discount",
      reward_value: "",
      is_active: true,
    });
    setIsFormOpen(true);
  };

  const handleEdit = (reward: Reward) => {
    setEditingReward(reward);
    setFormData(reward);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync(formData);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reward Catalog</CardTitle>
            <CardDescription>
              Manage rewards that customers can redeem with points
            </CardDescription>
          </div>
          <Button onClick={handleCreate} className="min-h-[44px] touch-manipulation">
            <Plus className="h-4 w-4 mr-2" />
            New Reward
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rewards && rewards.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reward Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Points Required</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((reward) => (
                <TableRow key={reward.id}>
                  <TableCell className="font-medium">{reward.reward_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{reward.reward_type}</Badge>
                  </TableCell>
                  <TableCell>{reward.points_required} pts</TableCell>
                  <TableCell>{reward.reward_value || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={reward.is_active ? "default" : "secondary"}>
                      {reward.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(reward)}
                        className="h-11 w-11 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          confirm({
                            title: 'Delete Reward',
                            itemName: reward.reward_name,
                            itemType: 'reward',
                            onConfirm: async () => {
                              setLoading(true);
                              try {
                                await deleteMutation.mutateAsync(reward.id!);
                                closeDialog();
                              } finally {
                                setLoading(false);
                              }
                            },
                          });
                        }}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EnhancedEmptyState
            icon={Gift}
            title="No Rewards Yet"
            description="Create your first reward to let customers redeem their points."
            primaryAction={{
              label: "Create Reward",
              onClick: handleCreate,
              icon: Plus,
            }}
            compact
          />
        )}

        {/* Reward Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingReward ? "Edit Reward" : "Create New Reward"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reward_name">
                  Reward Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reward_name"
                  value={formData.reward_name}
                  onChange={(e) =>
                    setFormData({ ...formData, reward_name: e.target.value })
                  }
                  placeholder="e.g., 10% Off Next Order"
                  required
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reward_description">Description</Label>
                <Textarea
                  id="reward_description"
                  value={formData.reward_description}
                  onChange={(e) =>
                    setFormData({ ...formData, reward_description: e.target.value })
                  }
                  placeholder="Describe this reward"
                  rows={3}
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="points_required">
                    Points Required <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="points_required"
                    type="number"
                    min="1"
                    value={formData.points_required}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        points_required: parseInt(e.target.value) || 0,
                      })
                    }
                    required
                    className="min-h-[44px] touch-manipulation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reward_type">
                    Reward Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.reward_type}
                    onValueChange={(value: Reward["reward_type"]) =>
                      setFormData({ ...formData, reward_type: value })
                    }
                  >
                    <SelectTrigger className="min-h-[44px] touch-manipulation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="free_product">Free Product</SelectItem>
                      <SelectItem value="free_delivery">Free Delivery</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reward_value">Reward Value</Label>
                <Input
                  id="reward_value"
                  value={formData.reward_value}
                  onChange={(e) =>
                    setFormData({ ...formData, reward_value: e.target.value })
                  }
                  placeholder="e.g., 10% or Product Name"
                  className="min-h-[44px] touch-manipulation"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Make this reward available for redemption
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={createMutation.isPending}
                  className="min-h-[44px] touch-manipulation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="min-h-[44px] touch-manipulation"
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingReward ? "Update Reward" : "Create Reward"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDeleteDialog
          open={dialogState.open}
          onOpenChange={(open) => !open && closeDialog()}
          onConfirm={dialogState.onConfirm}
          title={dialogState.title}
          itemName={dialogState.itemName}
          itemType={dialogState.itemType}
          isLoading={dialogState.isLoading}
        />
      </CardContent>
    </Card>
  );
}

