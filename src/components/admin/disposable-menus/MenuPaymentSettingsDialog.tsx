// @ts-nocheck - Supabase types not yet regenerated
/**
 * MenuPaymentSettingsDialog - Per-menu payment method overrides
 * Allows overriding tenant-level payment settings for individual menus
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantPaymentSettings, type PaymentSettings } from '@/hooks/usePaymentSettings';
import { queryKeys } from '@/lib/queryKeys';
import { Loader2, DollarSign, Bitcoin, Zap, Wallet, Info, Undo2 } from 'lucide-react';
import type { DisposableMenu } from '@/types/admin';

interface MenuPaymentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: DisposableMenu;
}

type PaymentOverrides = Partial<PaymentSettings>;

export function MenuPaymentSettingsDialog({
  open,
  onOpenChange,
  menu,
}: MenuPaymentSettingsDialogProps) {
  const queryClient = useQueryClient();
  const { data: tenantSettings, isLoading: isLoadingTenant } = useTenantPaymentSettings();
  
  // Parse existing overrides from menu
  // @ts-ignore - payment_settings exists in database but not in generated types
  const existingOverrides: PaymentOverrides = ((menu as any).payment_settings as PaymentOverrides) || {};
  
  const [overrides, setOverrides] = useState<PaymentOverrides>(existingOverrides);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      // @ts-ignore - payment_settings exists in database but not in generated types
      const menuOverrides = ((menu as any).payment_settings as PaymentOverrides) || {};
      setOverrides(menuOverrides);
      setHasChanges(false);
    }
    // @ts-ignore - payment_settings exists in database but not in generated types
  }, [open, (menu as any).payment_settings]);

  const updateOverride = <K extends keyof PaymentSettings>(
    key: K,
    value: PaymentSettings[K] | undefined
  ) => {
    setOverrides(prev => {
      const newOverrides = { ...prev };
      if (value === undefined || value === tenantSettings?.[key]) {
        // Remove override if it matches tenant default
        delete newOverrides[key];
      } else {
        newOverrides[key] = value;
      }
      return newOverrides;
    });
    setHasChanges(true);
  };

  const clearAllOverrides = () => {
    setOverrides({});
    setHasChanges(true);
  };

  const saveOverrides = useMutation({
    mutationFn: async () => {
      const paymentSettings = Object.keys(overrides).length > 0 ? overrides : null;
      
      // @ts-ignore - payment_settings exists in database but not in generated types
      const { error } = await supabase
        .from('disposable_menus')
        .update({ payment_settings: paymentSettings } as any)
        .eq('id', menu.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menuPaymentSettings(menu.id) });
      toast.success('Payment settings saved!');
      setHasChanges(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Failed to save settings', { description: error.message });
    },
  });

  // Get effective value (override or tenant default)
  const getEffectiveValue = <K extends keyof PaymentSettings>(key: K): PaymentSettings[K] => {
    if (key in overrides) {
      return overrides[key] as PaymentSettings[K];
    }
    return (tenantSettings as any)?.[key] as PaymentSettings[K];
  };

  // Check if a setting is overridden
  const isOverridden = (key: keyof PaymentSettings): boolean => {
    return key in overrides;
  };

  const overrideCount = Object.keys(overrides).length;

  if (isLoadingTenant) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payment Settings for "{menu.name}"
          </DialogTitle>
          <DialogDescription>
            Override tenant-level payment settings for this specific menu.
            Settings not overridden will use your global defaults.
          </DialogDescription>
        </DialogHeader>

        {overrideCount > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {overrideCount} setting{overrideCount !== 1 ? 's' : ''} overridden for this menu
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllOverrides}
                className="text-destructive hover:text-destructive"
              >
                <Undo2 className="h-4 w-4 mr-1" />
                Reset All
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="traditional" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="traditional">Traditional</TabsTrigger>
            <TabsTrigger value="crypto">Cryptocurrency</TabsTrigger>
          </TabsList>

          <TabsContent value="traditional" className="space-y-4 mt-4">
            {/* Cash */}
            <Card className={isOverridden('accept_cash') ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <CardTitle className="text-base">Cash</CardTitle>
                    {isOverridden('accept_cash') && (
                      <Badge variant="secondary" className="text-xs">Overridden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={getEffectiveValue('accept_cash') ?? false}
                    onCheckedChange={(checked) => updateOverride('accept_cash', checked)}
                  />
                </div>
                <CardDescription>Accept cash payments on delivery/pickup</CardDescription>
              </CardHeader>
              {getEffectiveValue('accept_cash') && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label>Instructions (optional)</Label>
                    <Textarea
                      placeholder={(tenantSettings as any)?.cash_instructions || 'Enter instructions...'}
                      value={overrides.cash_instructions ?? ''}
                      onChange={(e) => updateOverride('cash_instructions', e.target.value || undefined)}
                      className="min-h-[60px]"
                    />
                    {isOverridden('cash_instructions') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateOverride('cash_instructions', undefined)}
                        className="text-xs text-muted-foreground"
                      >
                        Use tenant default
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Zelle */}
            <Card className={isOverridden('accept_zelle') ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <CardTitle className="text-base">Zelle</CardTitle>
                    {isOverridden('accept_zelle') && (
                      <Badge variant="secondary" className="text-xs">Overridden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={getEffectiveValue('accept_zelle') ?? false}
                    onCheckedChange={(checked) => updateOverride('accept_zelle', checked)}
                  />
                </div>
                <CardDescription>Accept Zelle payments</CardDescription>
              </CardHeader>
              {getEffectiveValue('accept_zelle') && (
                <CardContent className="pt-0 space-y-3">
                  <div className="space-y-2">
                    <Label>Zelle Username/Email</Label>
                    <Input
                      placeholder={tenantSettings?.zelle_username || 'Enter username...'}
                      value={overrides.zelle_username ?? ''}
                      onChange={(e) => updateOverride('zelle_username', e.target.value || undefined)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zelle Phone</Label>
                    <Input
                      placeholder={tenantSettings?.zelle_phone || 'Enter phone...'}
                      value={overrides.zelle_phone ?? ''}
                      onChange={(e) => updateOverride('zelle_phone', e.target.value || undefined)}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* CashApp */}
            <Card className={isOverridden('accept_cashapp') ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <CardTitle className="text-base">CashApp</CardTitle>
                    {isOverridden('accept_cashapp') && (
                      <Badge variant="secondary" className="text-xs">Overridden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={getEffectiveValue('accept_cashapp') ?? false}
                    onCheckedChange={(checked) => updateOverride('accept_cashapp', checked)}
                  />
                </div>
                <CardDescription>Accept CashApp payments</CardDescription>
              </CardHeader>
              {getEffectiveValue('accept_cashapp') && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label>CashApp Cashtag</Label>
                    <Input
                      placeholder={tenantSettings?.cashapp_username || '$YourCashtag'}
                      value={overrides.cashapp_username ?? ''}
                      onChange={(e) => updateOverride('cashapp_username', e.target.value || undefined)}
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="crypto" className="space-y-4 mt-4">
            {/* Bitcoin */}
            <Card className={isOverridden('accept_bitcoin') ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bitcoin className="h-4 w-4 text-orange-500" />
                    <CardTitle className="text-base">Bitcoin (BTC)</CardTitle>
                    {isOverridden('accept_bitcoin') && (
                      <Badge variant="secondary" className="text-xs">Overridden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={getEffectiveValue('accept_bitcoin') ?? false}
                    onCheckedChange={(checked) => updateOverride('accept_bitcoin', checked)}
                  />
                </div>
                <CardDescription>Accept Bitcoin on-chain payments</CardDescription>
              </CardHeader>
              {getEffectiveValue('accept_bitcoin') && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label>Bitcoin Address</Label>
                    <Input
                      placeholder={tenantSettings?.bitcoin_address || 'bc1q...'}
                      value={overrides.bitcoin_address ?? ''}
                      onChange={(e) => updateOverride('bitcoin_address', e.target.value || undefined)}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Lightning */}
            <Card className={isOverridden('accept_lightning') ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    <CardTitle className="text-base">Lightning (LN)</CardTitle>
                    {isOverridden('accept_lightning') && (
                      <Badge variant="secondary" className="text-xs">Overridden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={getEffectiveValue('accept_lightning') ?? false}
                    onCheckedChange={(checked) => updateOverride('accept_lightning', checked)}
                  />
                </div>
                <CardDescription>Accept instant Lightning payments</CardDescription>
              </CardHeader>
              {getEffectiveValue('accept_lightning') && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label>Lightning Address</Label>
                    <Input
                      placeholder={tenantSettings?.lightning_address || 'user@domain.com'}
                      value={overrides.lightning_address ?? ''}
                      onChange={(e) => updateOverride('lightning_address', e.target.value || undefined)}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Ethereum */}
            <Card className={isOverridden('accept_ethereum') ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-info" />
                    <CardTitle className="text-base">Ethereum (ETH)</CardTitle>
                    {isOverridden('accept_ethereum') && (
                      <Badge variant="secondary" className="text-xs">Overridden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={getEffectiveValue('accept_ethereum') ?? false}
                    onCheckedChange={(checked) => updateOverride('accept_ethereum', checked)}
                  />
                </div>
                <CardDescription>Accept Ethereum payments</CardDescription>
              </CardHeader>
              {getEffectiveValue('accept_ethereum') && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label>Ethereum Address</Label>
                    <Input
                      placeholder={tenantSettings?.ethereum_address || '0x...'}
                      value={overrides.ethereum_address ?? ''}
                      onChange={(e) => updateOverride('ethereum_address', e.target.value || undefined)}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* USDT */}
            <Card className={isOverridden('accept_usdt') ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-success" />
                    <CardTitle className="text-base">USDT (Tether)</CardTitle>
                    {isOverridden('accept_usdt') && (
                      <Badge variant="secondary" className="text-xs">Overridden</Badge>
                    )}
                  </div>
                  <Switch
                    checked={getEffectiveValue('accept_usdt') ?? false}
                    onCheckedChange={(checked) => updateOverride('accept_usdt', checked)}
                  />
                </div>
                <CardDescription>Accept USDT stablecoin payments</CardDescription>
              </CardHeader>
              {getEffectiveValue('accept_usdt') && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <Label>USDT Address (ERC-20)</Label>
                    <Input
                      placeholder={tenantSettings?.usdt_address || '0x...'}
                      value={overrides.usdt_address ?? ''}
                      onChange={(e) => updateOverride('usdt_address', e.target.value || undefined)}
                      className="font-mono text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Crypto Instructions */}
            {(getEffectiveValue('accept_bitcoin') || 
              getEffectiveValue('accept_lightning') || 
              getEffectiveValue('accept_ethereum') || 
              getEffectiveValue('accept_usdt')) && (
              <Card className={isOverridden('crypto_instructions') ? 'border-primary' : ''}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Crypto Payment Instructions</CardTitle>
                  <CardDescription>General instructions for all crypto payments</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Textarea
                    placeholder={tenantSettings?.crypto_instructions || 'Enter instructions for crypto payments...'}
                    value={overrides.crypto_instructions ?? ''}
                    onChange={(e) => updateOverride('crypto_instructions', e.target.value || undefined)}
                    className="min-h-[80px]"
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveOverrides.mutate()}
            disabled={!hasChanges || saveOverrides.isPending}
          >
            {saveOverrides.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

