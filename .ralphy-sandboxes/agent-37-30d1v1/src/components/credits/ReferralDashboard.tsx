/**
 * ReferralDashboard Component
 * 
 * Shows referral code, stats, and sharing options.
 * Displays in Settings or as a standalone page.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Gift,
  Users,
  Copy,
  Check,
  Share2,
  TrendingUp,
  Coins,
  UserPlus,
  RefreshCw,
  Mail,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  getOrCreateReferralCode,
  getReferralStats,
  getReferralLink,
  copyReferralLink,
  REFERRAL_REWARDS,
} from '@/lib/credits/referralService';

export interface ReferralDashboardProps {
  className?: string;
  compact?: boolean;
}

export function ReferralDashboard({
  className,
  compact = false,
}: ReferralDashboardProps) {
  const { tenant } = useTenantAdminAuth();
  const [copied, setCopied] = useState(false);

  const tenantId = tenant?.id;

  // Fetch referral code
  const {
    data: referralCode,
    isLoading: codeLoading,
  } = useQuery({
    queryKey: ['referral-code', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return getOrCreateReferralCode(tenantId);
    },
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch stats
  const {
    data: stats,
  } = useQuery({
    queryKey: ['referral-stats', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return getReferralStats(tenantId);
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000, // 1 minute
  });

  // Handle copy
  const handleCopy = async () => {
    if (!referralCode) return;

    const success = await copyReferralLink(referralCode.code);
    if (success) {
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error('Failed to copy link');
    }
  };

  // Handle share (native share API)
  const handleShare = async () => {
    if (!referralCode) return;

    const link = getReferralLink(referralCode.code);
    const shareData = {
      title: 'Join me on BigMike Wholesale',
      text: `Sign up using my link and we both get ${REFERRAL_REWARDS.refereeBonus.toLocaleString()} bonus credits!`,
      url: link,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await handleCopy();
      }
    } catch (error) {
      // User cancelled or share failed
      if ((error as Error).name !== 'AbortError') {
        await handleCopy();
      }
    }
  };

  // Handle email share
  const handleEmailShare = () => {
    if (!referralCode) return;

    const link = getReferralLink(referralCode.code);
    const subject = encodeURIComponent('Join me on BigMike Wholesale');
    const body = encodeURIComponent(
      `I've been using BigMike Wholesale and thought you'd like it too!\n\n` +
      `Sign up using my link and we'll both get ${REFERRAL_REWARDS.refereeBonus.toLocaleString()} bonus credits:\n${link}`
    );

    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  if (codeLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Compact view (for sidebar or small cards)
  if (compact) {
    return (
      <Card className={cn('bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800', className)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-500" />
            <span className="font-medium">Invite & Earn</span>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Get {REFERRAL_REWARDS.referrerBonus.toLocaleString()} credits for each friend who signs up
          </p>
          
          {referralCode && (
            <div className="flex items-center gap-2">
              <Input
                value={referralCode.code}
                readOnly
                className="font-mono text-center bg-white dark:bg-background"
              />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          
          {stats && stats.totalReferrals > 0 && (
            <div className="text-xs text-muted-foreground">
              {stats.totalReferrals} referral{stats.totalReferrals !== 1 ? 's' : ''} • {stats.totalCreditsEarned.toLocaleString()} credits earned
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-purple-500" />
            Invite Friends & Earn Credits
          </CardTitle>
          <CardDescription>
            Share your referral link and earn credits when friends sign up
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Rewards Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4 text-center">
              <UserPlus className="h-8 w-8 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-600">
                +{REFERRAL_REWARDS.referrerBonus.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">You get</p>
            </div>
            <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4 text-center">
              <Sparkles className="h-8 w-8 text-pink-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-pink-600">
                +{REFERRAL_REWARDS.refereeBonus.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Friend gets</p>
            </div>
            <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4 text-center">
              <TrendingUp className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold text-emerald-600">
                +{REFERRAL_REWARDS.paidConversionBonus.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">If they upgrade</p>
            </div>
          </div>

          {/* Referral Code */}
          {referralCode && (
            <div className="space-y-3">
              <label className="text-sm font-medium">Your Referral Link</label>
              <div className="flex items-center gap-2">
                <Input
                  value={getReferralLink(referralCode.code)}
                  readOnly
                  className="font-mono text-sm bg-white dark:bg-background"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy link</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Share Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="default" onClick={handleShare} className="bg-purple-600 hover:bg-purple-700">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="outline" onClick={handleEmailShare}>
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.totalReferrals}</p>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Coins className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.totalCreditsEarned.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Credits Earned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <RefreshCw className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.pendingConversions}</p>
              <p className="text-sm text-muted-foreground">Pending Conversions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.conversionRate.toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Referrals */}
      {stats && stats.recentReferrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      referral.converted 
                        ? 'bg-emerald-100 dark:bg-emerald-900' 
                        : 'bg-blue-100 dark:bg-blue-900'
                    )}>
                      <UserPlus className={cn(
                        'h-4 w-4',
                        referral.converted ? 'text-emerald-600' : 'text-blue-600'
                      )} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        New user signed up
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {referral.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">
                      +{referral.creditsEarned.toLocaleString()}
                    </p>
                    <Badge 
                      variant={referral.converted ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {referral.converted ? 'Converted' : 'Free tier'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No referrals yet */}
      {stats && stats.totalReferrals === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No referrals yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Share your link with friends to start earning credits!
            </p>
            <Button onClick={handleShare} className="bg-purple-600 hover:bg-purple-700">
              <Share2 className="h-4 w-4 mr-2" />
              Share Your Link
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}







