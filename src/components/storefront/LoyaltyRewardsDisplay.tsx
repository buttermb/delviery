/**
 * Storefront Loyalty Rewards Display
 * Shows customer loyalty points, history, and available rewards
 */

import { useQuery } from '@tanstack/react-query';
import { Gift, Star, Clock, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface LoyaltyPoints {
  balance: number;
  lifetime_points: number;
}

interface PointsHistoryEntry {
  id: string;
  points: number;
  type: 'earned' | 'redeemed' | 'expired';
  description: string;
  created_at: string;
}

interface LoyaltyReward {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
}

interface LoyaltyRewardsDisplayProps {
  customerId: string;
  tenantSlug: string;
  onRedeem?: (rewardId: string) => void;
}

function formatHistoryDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function LoyaltyRewardsDisplay({
  customerId,
  tenantSlug,
  onRedeem,
}: LoyaltyRewardsDisplayProps) {
  const { data: loyaltyData, isLoading } = useQuery({
    queryKey: queryKeys.loyalty.customer(customerId),
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (!tenant) return null;

      const [balanceResult, historyResult, rewardsResult] = await Promise.all([
        supabase.from('loyalty_points')
          .select('balance, lifetime_points')
          .eq('customer_id', customerId)
          .eq('tenant_id', tenant.id)
          .maybeSingle(),
        // loyalty_points_history not in generated types yet — narrow cast to table name only
        supabase.from('loyalty_points_history' as never)
          .select('id, points, type, description, created_at')
          .eq('customer_id', customerId)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false })
          .limit(20) as unknown as { data: PointsHistoryEntry[] | null; error: { message: string } | null },
        supabase.from('loyalty_rewards')
          .select('id, name, description, points_required, active')
          .eq('tenant_id', tenant.id)
          .eq('active', true)
          .order('points_required', { ascending: true }),
      ]);

      if (balanceResult.error) {
        logger.error('Failed to fetch loyalty balance', balanceResult.error);
      }
      if (historyResult.error) {
        logger.error('Failed to fetch loyalty history', historyResult.error);
      }
      if (rewardsResult.error) {
        logger.error('Failed to fetch loyalty rewards', rewardsResult.error);
      }

      return {
        balance: balanceResult.data,
        history: historyResult.data || [],
        rewards: rewardsResult.data || [],
      };
    },
    enabled: !!customerId && !!tenantSlug,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading rewards...</div>;
  }

  if (!loyaltyData?.balance) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Gift className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No loyalty account found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Make a purchase to start earning points
          </p>
        </CardContent>
      </Card>
    );
  }

  const { balance, history, rewards } = loyaltyData;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'earned':
        return <Star className="h-4 w-4 text-green-500" />;
      case 'redeemed':
        return <Gift className="h-4 w-4 text-blue-500" />;
      case 'expired':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const getPointsDisplay = (entry: PointsHistoryEntry) => {
    const prefix = entry.type === 'earned' ? '+' : '-';
    const colorClass = entry.type === 'earned' ? 'text-green-600' : 'text-muted-foreground';
    return <span className={`font-medium ${colorClass}`}>{prefix}{Math.abs(entry.points)}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Points Balance */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
              <Award className="h-8 w-8 text-primary" />
            </div>
            <p className="text-4xl font-bold">{balance.balance.toLocaleString()}</p>
            <p className="text-muted-foreground mt-1">Available Points</p>
            <p className="text-sm text-muted-foreground mt-2">
              Lifetime earned: {balance.lifetime_points.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Available Rewards */}
      {rewards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Available Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rewards.map((reward) => {
                const canRedeem = balance.balance >= reward.points_required;
                return (
                  <div
                    key={reward.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{reward.name}</p>
                      {reward.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {reward.description}
                        </p>
                      )}
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {reward.points_required.toLocaleString()} pts
                      </Badge>
                    </div>
                    {onRedeem && (
                      <Button
                        variant={canRedeem ? 'default' : 'outline'}
                        size="sm"
                        disabled={!canRedeem}
                        onClick={() => onRedeem(reward.id)}
                      >
                        Redeem
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Points History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Points History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {history.map((entry, index) => (
                <div key={entry.id}>
                  <div className="flex items-center gap-3 py-2">
                    {getTypeIcon(entry.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatHistoryDate(entry.created_at)}
                      </p>
                    </div>
                    {getPointsDisplay(entry)}
                  </div>
                  {index < history.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
