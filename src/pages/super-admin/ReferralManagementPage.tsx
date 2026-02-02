/**
 * Referral Management Page - Super Admin
 * 
 * Monitor and manage the referral program across the platform.
 */

import { useQuery } from '@tanstack/react-query';
import Users from "lucide-react/dist/esm/icons/users";
import Gift from "lucide-react/dist/esm/icons/gift";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Crown from "lucide-react/dist/esm/icons/crown";
import Coins from "lucide-react/dist/esm/icons/coins";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAdminReferralStats, REFERRAL_REWARDS } from '@/lib/credits';

export default function ReferralManagementPage() {
  // Fetch referral stats
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['admin-referral-stats'],
    queryFn: getAdminReferralStats,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Program</h1>
          <p className="text-muted-foreground">
            Monitor referral activity and manage rewards
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalReferrals || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Successful signups
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits Awarded</CardTitle>
            <Coins className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {(stats?.totalCreditsAwarded || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total credits distributed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalConversions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Referees upgraded to paid
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Crown className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats?.totalReferrals
                    ? Math.round((stats.totalConversions / stats.totalReferrals) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Referrals to paid
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referral Program Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Rewards Configuration</CardTitle>
          <CardDescription>Current reward amounts for the referral program</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium">Referrer Bonus</h4>
              </div>
              <p className="text-3xl font-bold text-blue-600">
                +{REFERRAL_REWARDS.referrerBonus.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                credits when someone signs up
              </p>
            </div>

            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Referee Bonus</h4>
              </div>
              <p className="text-3xl font-bold text-green-600">
                +{REFERRAL_REWARDS.refereeBonus.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                credits for new signups
              </p>
            </div>

            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-purple-600" />
                <h4 className="font-medium">Conversion Bonus</h4>
              </div>
              <p className="text-3xl font-bold text-purple-600">
                +{REFERRAL_REWARDS.paidConversionBonus.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                when referee upgrades to paid
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending and Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Referrers Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Referrers
            </CardTitle>
            <CardDescription>Leaderboard of most successful referrers</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats?.topReferrers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No referrals yet
              </div>
            ) : (
              <div className="space-y-2">
                {stats?.topReferrers.map((referrer, i) => (
                  <div
                    key={referrer.tenantId}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-700' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium">{referrer.tenantName}</p>
                        <p className="text-xs text-muted-foreground">
                          {referrer.referrals} referrals
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 font-mono">
                      +{referrer.creditsEarned.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Conversions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Pending Conversions
            </CardTitle>
            <CardDescription>Referrals awaiting upgrade to paid</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-4xl font-bold text-orange-600 mb-2">
                {stats?.pendingConversions || 0}
              </div>
              <p className="text-muted-foreground">
                referees on free tier
              </p>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  Each conversion will award the referrer{' '}
                  <span className="font-bold text-purple-600">
                    +{REFERRAL_REWARDS.paidConversionBonus.toLocaleString()} credits
                  </span>
                </p>
              </div>
            </div>

            {/* Conversion Progress */}
            {stats && stats.totalReferrals > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Conversion Progress</span>
                  <span className="text-muted-foreground">
                    {stats.totalConversions} / {stats.totalReferrals}
                  </span>
                </div>
                <Progress 
                  value={(stats.totalConversions / stats.totalReferrals) * 100} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Converted</span>
                  <span>Total Referrals</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Program Stats Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Program Summary</CardTitle>
          <CardDescription>Overall referral program performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold">{stats?.totalReferrals || 0}</div>
              <div className="text-sm text-muted-foreground">Total Signups</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold">{stats?.totalConversions || 0}</div>
              <div className="text-sm text-muted-foreground">Paid Conversions</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold text-green-600">
                {(stats?.totalCreditsAwarded || 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Credits Distributed</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats?.topReferrers.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Active Referrers</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

