/**
 * Tenant Credit Detail Panel
 * 
 * Slide-out panel showing comprehensive credit information
 * for a specific tenant.
 */

import { useState } from 'react';
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Gift,
  Users,
  Activity,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { type TenantCreditDetail, FREE_TIER_MONTHLY_CREDITS } from '@/lib/credits';

interface TenantCreditDetailPanelProps {
  detail: TenantCreditDetail;
  onAdjust: () => void;
  onClose: () => void;
}

export function TenantCreditDetailPanel({
  detail,
  onAdjust,
  onClose,
}: TenantCreditDetailPanelProps) {
  const { tenant, credits, recentTransactions, grants, referralInfo } = detail;

  // Calculate percentages
  const balancePercent = Math.min(100, (credits.balance / FREE_TIER_MONTHLY_CREDITS) * 100);
  const usedPercent = credits.lifetimeEarned > 0 
    ? Math.min(100, (credits.lifetimeSpent / credits.lifetimeEarned) * 100) 
    : 0;

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Tenant Info Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{tenant.name}</h3>
          <p className="text-sm text-muted-foreground">@{tenant.slug}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={tenant.isFreeTier ? 'secondary' : 'default'}>
              {tenant.isFreeTier ? 'Free Tier' : 'Paid Subscriber'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Joined {formatDate(tenant.createdAt)}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onAdjust}>
          <Edit className="h-4 w-4 mr-1" />
          Adjust
        </Button>
      </div>

      <Separator />

      {/* Credit Balance Overview */}
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Credit Balance
        </h4>

        {/* Current Balance */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-3xl font-bold">
              {credits.balance.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">
              / {FREE_TIER_MONTHLY_CREDITS.toLocaleString()} monthly
            </span>
          </div>
          <Progress value={balancePercent} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{Math.round(balancePercent)}% remaining</span>
            <span>
              {credits.tierStatus === 'free' ? 'Free Tier' : 'Paid'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-sm text-muted-foreground">Today</div>
            <div className="text-lg font-semibold">
              {credits.creditsUsedToday.toLocaleString()}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-sm text-muted-foreground">This Week</div>
            <div className="text-lg font-semibold">
              {credits.creditsUsedThisWeek.toLocaleString()}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-sm text-muted-foreground">This Month</div>
            <div className="text-lg font-semibold">
              {credits.creditsUsedThisMonth.toLocaleString()}
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-sm text-muted-foreground">Lifetime</div>
            <div className="text-lg font-semibold">
              {credits.lifetimeSpent.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Grant Dates */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Last grant: {formatDate(credits.lastFreeGrantAt)}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            Next: {formatDate(credits.nextFreeGrantAt)}
          </div>
        </div>
      </div>

      <Separator />

      {/* Tabs for Transactions and Grants */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="grants">Grants</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-4">
          <ScrollArea className="h-[300px]">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.amount > 0 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {tx.amount > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {tx.actionType || tx.transactionType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(tx.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono font-medium ${
                        tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {tx.balanceAfter.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Grants Tab */}
        <TabsContent value="grants" className="mt-4">
          <ScrollArea className="h-[300px]">
            {grants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No bonus grants received
              </div>
            ) : (
              <div className="space-y-2">
                {grants.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                        <Gift className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {grant.grantType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(grant.grantedAt)}
                        </p>
                        {grant.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {grant.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium text-green-600">
                        +{grant.amount.toLocaleString()}
                      </p>
                      {grant.expiresAt && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {formatDate(grant.expiresAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals" className="mt-4">
          {referralInfo ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Referral Program</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{referralInfo.totalReferrals}</div>
                    <div className="text-xs text-muted-foreground">Referrals</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      +{referralInfo.creditsEarned.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Credits Earned</div>
                  </div>
                  <div>
                    <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {referralInfo.referralCode}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Code</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No referral code generated</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Close
        </Button>
        <Button className="flex-1" onClick={onAdjust}>
          <Edit className="h-4 w-4 mr-2" />
          Adjust Credits
        </Button>
      </div>
    </div>
  );
}







