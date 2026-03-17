import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Star, Plus, Minus, TrendingUp, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { formatDistanceToNow } from 'date-fns';

interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  points_change: number;
  transaction_type: 'earn' | 'redeem' | 'adjust' | 'expire';
  description: string;
  created_at: string;
  created_by: string | null;
}

interface CustomerLoyaltyData {
  customer_id: string;
  points_balance: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  updated_at: string;
}

interface CustomerLoyaltyPointsProps {
  customerId: string;
  customerName: string;
}

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 5000,
};

const TIER_COLORS = {
  bronze: 'bg-amber-600',
  silver: 'bg-gray-400',
  gold: 'bg-yellow-500',
  platinum: 'bg-purple-600',
};

function calculateTier(lifetimePoints: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return 'gold';
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

/**
 * CustomerLoyaltyPoints component
 *
 * Displays and manages customer loyalty points, transactions, and tier status.
 * Allows admins to adjust points manually.
 */
export function CustomerLoyaltyPoints({ customerId, customerName }: CustomerLoyaltyPointsProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Fetch loyalty data
  const { data: loyaltyData, isLoading: isLoadingLoyalty } = useQuery({
    queryKey: queryKeys.customers.detail(customerId, 'loyalty'),
    queryFn: async () => {
      if (!tenant?.id) return null;

      // customer_loyalty not in generated types yet — narrow cast to table name only
      const { data, error } = await (supabase.from('customer_loyalty' as never)
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .maybeSingle() as unknown as Promise<{ data: CustomerLoyaltyData | null; error: { message: string } | null }>);

      if (error) throw error;

      // Initialize if doesn't exist
      if (!data) {
        const { data: newRecord, error: insertError } = await (supabase.from('customer_loyalty' as never)
          .insert({
            tenant_id: tenant.id,
            customer_id: customerId,
            points_balance: 0,
            lifetime_points_earned: 0,
            lifetime_points_redeemed: 0,
            tier: 'bronze',
          })
          .select()
          .single() as unknown as Promise<{ data: CustomerLoyaltyData | null; error: { message: string } | null }>);

        if (insertError) throw insertError;
        return newRecord as CustomerLoyaltyData;
      }

      return data;
    },
    enabled: !!tenant?.id && !!customerId,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: queryKeys.customers.detail(customerId, 'loyalty-transactions'),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as LoyaltyTransaction[];
    },
    enabled: !!tenant?.id && !!customerId,
  });

  // Adjust points mutation
  const adjustPointsMutation = useMutation({
    mutationFn: async ({ points, reason }: { points: number; reason: string }) => {
      if (!tenant?.id || !admin?.id) throw new Error('Not authenticated');

      const isPositive = points > 0;
      const transactionType = isPositive ? 'earn' : 'redeem';

      // Insert transaction
      const { error: txError } = await supabase
        .from('loyalty_transactions')
        .insert({
          tenant_id: tenant.id,
          customer_id: customerId,
          points_change: points,
          transaction_type: 'adjust',
          description: reason,
          created_by: admin?.id,
        });

      if (txError) throw txError;

      // Update balance
      const newBalance = (loyaltyData?.points_balance || 0) + points;
      const newLifetimeEarned = isPositive
        ? (loyaltyData?.lifetime_points_earned || 0) + points
        : loyaltyData?.lifetime_points_earned || 0;
      const newLifetimeRedeemed = !isPositive
        ? (loyaltyData?.lifetime_points_redeemed || 0) + Math.abs(points)
        : loyaltyData?.lifetime_points_redeemed || 0;

      const newTier = calculateTier(newLifetimeEarned);

      // customer_loyalty not in generated types yet — narrow cast to table name only
      const { error: updateError } = await (supabase.from('customer_loyalty' as never)
        .update({
          points_balance: newBalance,
          lifetime_points_earned: newLifetimeEarned,
          lifetime_points_redeemed: newLifetimeRedeemed,
          tier: newTier,
        })
        .eq('tenant_id', tenant.id)
        .eq('customer_id', customerId) as unknown as Promise<{ error: { message: string } | null }>);

      if (updateError) throw updateError;

      return { points, reason };
    },
    onSuccess: (result) => {
      toast.success(
        `${result.points > 0 ? 'Added' : 'Deducted'} ${Math.abs(result.points)} points`
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId, 'loyalty') });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(customerId, 'loyalty-transactions'),
      });
      setAdjustDialogOpen(false);
      setAdjustAmount('');
      setAdjustReason('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to adjust points: ${error.message}`);
    },
  });

  const handleAdjustPoints = () => {
    const points = parseInt(adjustAmount, 10);
    if (isNaN(points) || points === 0) {
      toast.error('Please enter a valid point amount');
      return;
    }
    if (!adjustReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    adjustPointsMutation.mutate({ points, reason: adjustReason });
  };

  if (isLoadingLoyalty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loyalty Points</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const tier = loyaltyData?.tier || 'bronze';
  const tierColor = TIER_COLORS[tier];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loyalty Points</CardTitle>
              <CardDescription>{customerName}</CardDescription>
            </div>
            <Badge className={`${tierColor} text-white uppercase`}>{tier}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Points Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <Star className="h-4 w-4" />
                <span className="text-sm font-medium">Current Balance</span>
              </div>
              <p className="text-2xl font-bold">{loyaltyData?.points_balance || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Lifetime Earned</span>
              </div>
              <p className="text-2xl font-bold">{loyaltyData?.lifetime_points_earned || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Gift className="h-4 w-4" />
                <span className="text-sm font-medium">Lifetime Redeemed</span>
              </div>
              <p className="text-2xl font-bold">{loyaltyData?.lifetime_points_redeemed || 0}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={() => setAdjustDialogOpen(true)} variant="outline" className="flex-1">
              <Plus className="mr-2 h-4 w-4" />
              Adjust Points
            </Button>
          </div>

          {/* Transaction History */}
          <div>
            <h4 className="font-semibold mb-3">Recent Transactions</h4>
            {isLoadingTransactions ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge
                      variant={tx.points_change > 0 ? 'default' : 'secondary'}
                      className={tx.points_change > 0 ? 'bg-emerald-500' : 'bg-gray-500'}
                    >
                      {tx.points_change > 0 ? '+' : ''}
                      {tx.points_change}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Adjust Points Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Loyalty Points</DialogTitle>
            <DialogDescription>
              Add or deduct points for {customerName}. Use positive for adding, negative for
              deducting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                placeholder="e.g., 100 or -50"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                placeholder="e.g., Birthday bonus, Complaint resolution"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustPoints} disabled={adjustPointsMutation.isPending}>
              {adjustPointsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Adjust Points'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
