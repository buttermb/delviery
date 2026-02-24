/**
 * AutoTopUpSettings Component
 * 
 * UI for configuring automatic credit top-up.
 * Shows in Settings > Billing for free tier users.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap,
  CreditCard,
  Shield,
  AlertCircle,
  Check,
  Loader2,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCredits } from '@/hooks/useCredits';
import {
  getAutoTopUpConfig,
  setupAutoTopUp,
  getAutoTopUpOptions,
  getThresholdOptions,
  getMaxPerMonthOptions,
} from '@/lib/credits/autoTopUp';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface AutoTopUpSettingsProps {
  className?: string;
  onPaymentMethodSetup?: () => void;
}

export function AutoTopUpSettings({
  className,
  onPaymentMethodSetup,
}: AutoTopUpSettingsProps) {
  const { tenant } = useTenantAdminAuth();
  const { isFreeTier, balance } = useCredits();
  const queryClient = useQueryClient();

  const tenantId = tenant?.id;

  // Local form state
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState('500');
  const [topUpAmount, setTopUpAmount] = useState('5000');
  const [maxPerMonth, setMaxPerMonth] = useState('3');
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.creditWidgets.autoTopupConfig(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      return getAutoTopUpConfig(tenantId);
    },
    enabled: !!tenantId && isFreeTier,
  });

  // Update local state when config loads
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setThreshold(config.triggerThreshold.toString());
      setTopUpAmount(config.topUpAmount.toString());
      setMaxPerMonth(config.maxPerMonth.toString());
      setHasPaymentMethod(!!config.paymentMethodId);
    }
  }, [config]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');

      return setupAutoTopUp({
        tenantId,
        enabled,
        triggerThreshold: parseInt(threshold),
        topUpAmount: parseInt(topUpAmount),
        maxPerMonth: parseInt(maxPerMonth),
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Auto top-up settings saved');
        queryClient.invalidateQueries({ queryKey: queryKeys.creditWidgets.autoTopupConfig(tenantId) });
      } else {
        toast.error(result.error || 'Failed to save settings');
      }
    },
    onError: (error) => {
      logger.error('Failed to save auto top-up settings', { error });
      toast.error('Failed to save settings', { description: humanizeError(error) });
    },
  });

  // Options
  const topUpOptions = getAutoTopUpOptions();
  const thresholdOptions = getThresholdOptions();
  const maxOptions = getMaxPerMonthOptions();

  // Calculate monthly max spend
  const selectedPackage = topUpOptions.find((o) => o.credits === parseInt(topUpAmount));
  const maxMonthlySpend = selectedPackage
    ? (selectedPackage.priceCents / 100) * parseInt(maxPerMonth)
    : 0;

  // Check if settings have changed
  const hasChanges =
    config &&
    (enabled !== config.enabled ||
      parseInt(threshold) !== config.triggerThreshold ||
      parseInt(topUpAmount) !== config.topUpAmount ||
      parseInt(maxPerMonth) !== config.maxPerMonth);

  // Don't show for paid tier
  if (!isFreeTier) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Auto Top-Up
            </CardTitle>
            <CardDescription>
              Automatically add credits when your balance gets low
            </CardDescription>
          </div>
          <Switch
            id="auto-topup-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!hasPaymentMethod}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* No payment method warning */}
        {!hasPaymentMethod && (
          <Alert>
            <CreditCard className="h-4 w-4" />
            <AlertTitle>Payment method required</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>Add a payment method to enable auto top-up.</span>
              {onPaymentMethodSetup && (
                <Button variant="outline" size="sm" onClick={onPaymentMethodSetup}>
                  Add Payment Method
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Settings (always visible but disabled without payment method) */}
        <div className={cn('space-y-4', !hasPaymentMethod && 'opacity-50 pointer-events-none')}>
          {/* Threshold */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="threshold">Trigger when balance falls below</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Auto top-up will trigger when your balance drops below this amount</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={threshold} onValueChange={setThreshold}>
              <SelectTrigger id="threshold">
                <SelectValue placeholder="Select threshold" />
              </SelectTrigger>
              <SelectContent>
                {thresholdOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {balance <= parseInt(threshold) && (
              <p className="text-xs text-amber-600">
                Your current balance ({balance.toLocaleString()}) is below this threshold
              </p>
            )}
          </div>

          {/* Top-up amount */}
          <div className="space-y-2">
            <Label htmlFor="topup-amount">Credits to add</Label>
            <Select value={topUpAmount} onValueChange={setTopUpAmount}>
              <SelectTrigger id="topup-amount">
                <SelectValue placeholder="Select amount" />
              </SelectTrigger>
              <SelectContent>
                {topUpOptions.map((opt) => (
                  <SelectItem key={opt.credits} value={opt.credits.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Max per month */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="max-per-month">Maximum top-ups per month</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Prevents unexpected charges by limiting auto top-ups</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={maxPerMonth} onValueChange={setMaxPerMonth}>
              <SelectTrigger id="max-per-month">
                <SelectValue placeholder="Select limit" />
              </SelectTrigger>
              <SelectContent>
                {maxOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">Summary</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                When balance falls below{' '}
                <span className="font-medium text-foreground">
                  {parseInt(threshold).toLocaleString()} credits
                </span>
              </p>
              <p>
                Add{' '}
                <span className="font-medium text-foreground">
                  {parseInt(topUpAmount).toLocaleString()} credits
                </span>{' '}
                for{' '}
                <span className="font-medium text-foreground">
                  ${selectedPackage ? (selectedPackage.priceCents / 100).toFixed(0) : '?'}
                </span>
              </p>
              <p>
                Maximum{' '}
                <span className="font-medium text-foreground">{maxPerMonth}x per month</span>
              </p>
            </div>
            <div className="pt-2 border-t mt-2">
              <p className="text-sm">
                Max monthly spend:{' '}
                <span className="font-semibold">${maxMonthlySpend.toFixed(0)}</span>
              </p>
            </div>
          </div>

          {/* This month's usage */}
          {config && config.topUpsThisMonth > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4" />
              <span>
                {config.topUpsThisMonth} top-up{config.topUpsThisMonth !== 1 ? 's' : ''} this month
                ({config.maxPerMonth - config.topUpsThisMonth} remaining)
              </span>
            </div>
          )}
        </div>

        {/* Save button */}
        {hasPaymentMethod && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !hasChanges}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : hasChanges ? (
              'Save Changes'
            ) : (
              'Settings Saved'
            )}
          </Button>
        )}

        {/* Upgrade suggestion */}
        <Alert className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
          <AlertCircle className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-200">
            Save money with a subscription
          </AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            Upgrading to a paid plan gives you unlimited usage without worrying about credits.
            Starting at just $79/month.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}







