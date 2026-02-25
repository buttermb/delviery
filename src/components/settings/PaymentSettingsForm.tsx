/**
 * PaymentSettingsForm - Reusable form for payment method configuration
 * Used in Settings page (global) and Menu settings (per-menu overrides)
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Banknote,
  Smartphone,
  Bitcoin,
  Zap,
  Coins,
  Save,
  Loader2,
  Copy,
} from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';

// Validation schema
const paymentSettingsSchema = z.object({
  // Payment method toggles
  accept_cash: z.boolean().default(true),
  accept_zelle: z.boolean().default(false),
  accept_cashapp: z.boolean().default(false),
  accept_bitcoin: z.boolean().default(false),
  accept_lightning: z.boolean().default(false),
  accept_ethereum: z.boolean().default(false),
  accept_usdt: z.boolean().default(false),
  // Payment details
  zelle_username: z.string().max(100).optional().nullable(),
  zelle_phone: z.string().regex(/^[\d\s\-+()]+$/, "Invalid phone number").min(7, "Phone number must be at least 7 characters").max(20, "Phone number must be 20 characters or less").optional().or(z.literal('')).nullable(),
  cashapp_username: z.string().max(100).optional().nullable(),
  bitcoin_address: z.string().max(100).optional().nullable(),
  lightning_address: z.string().max(200).optional().nullable(),
  ethereum_address: z.string().max(100).optional().nullable(),
  usdt_address: z.string().max(100).optional().nullable(),
  // Custom instructions
  cash_instructions: z.string().max(500).optional().nullable(),
  zelle_instructions: z.string().max(500).optional().nullable(),
  cashapp_instructions: z.string().max(500).optional().nullable(),
  crypto_instructions: z.string().max(500).optional().nullable(),
});

export type PaymentSettingsFormData = z.infer<typeof paymentSettingsSchema>;

interface PaymentSettingsFormProps {
  initialData?: Partial<PaymentSettingsFormData>;
  onSave: (data: PaymentSettingsFormData) => Promise<void>;
  isLoading?: boolean;
  showTitle?: boolean;
  compact?: boolean;
}

// Helper to validate Bitcoin address format (basic check)
const isValidBitcoinAddress = (address: string): boolean => {
  if (!address) return true;
  // Basic validation: starts with 1, 3, or bc1 and has correct length
  return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
};

// Helper to validate Ethereum address format
const isValidEthereumAddress = (address: string): boolean => {
  if (!address) return true;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export function PaymentSettingsForm({
  initialData,
  onSave,
  isLoading = false,
  showTitle = true,
  compact = false,
}: PaymentSettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('traditional');

  const form = useForm<PaymentSettingsFormData>({
    resolver: zodResolver(paymentSettingsSchema),
    defaultValues: {
      accept_cash: true,
      accept_zelle: false,
      accept_cashapp: false,
      accept_bitcoin: false,
      accept_lightning: false,
      accept_ethereum: false,
      accept_usdt: false,
      zelle_username: '',
      zelle_phone: '',
      cashapp_username: '',
      bitcoin_address: '',
      lightning_address: '',
      ethereum_address: '',
      usdt_address: '',
      cash_instructions: '',
      zelle_instructions: '',
      cashapp_instructions: '',
      crypto_instructions: '',
      ...initialData,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        accept_cash: initialData.accept_cash ?? true,
        accept_zelle: initialData.accept_zelle ?? false,
        accept_cashapp: initialData.accept_cashapp ?? false,
        accept_bitcoin: initialData.accept_bitcoin ?? false,
        accept_lightning: initialData.accept_lightning ?? false,
        accept_ethereum: initialData.accept_ethereum ?? false,
        accept_usdt: initialData.accept_usdt ?? false,
        zelle_username: initialData.zelle_username ?? '',
        zelle_phone: initialData.zelle_phone ?? '',
        cashapp_username: initialData.cashapp_username ?? '',
        bitcoin_address: initialData.bitcoin_address ?? '',
        lightning_address: initialData.lightning_address ?? '',
        ethereum_address: initialData.ethereum_address ?? '',
        usdt_address: initialData.usdt_address ?? '',
        cash_instructions: initialData.cash_instructions ?? '',
        zelle_instructions: initialData.zelle_instructions ?? '',
        cashapp_instructions: initialData.cashapp_instructions ?? '',
        crypto_instructions: initialData.crypto_instructions ?? '',
      });
    }
  }, [initialData, form]);

  const handleSubmit = async (data: PaymentSettingsFormData) => {
    try {
      setSaving(true);

      // Validate crypto addresses if enabled
      if (data.accept_bitcoin && data.bitcoin_address && !isValidBitcoinAddress(data.bitcoin_address)) {
        showErrorToast('Invalid Bitcoin Address', 'Please enter a valid Bitcoin address');
        return;
      }

      if ((data.accept_ethereum || data.accept_usdt) && data.ethereum_address && !isValidEthereumAddress(data.ethereum_address)) {
        showErrorToast('Invalid Ethereum Address', 'Please enter a valid Ethereum address (0x...)');
        return;
      }

      await onSave(data);
      showSuccessToast('Settings Saved', 'Payment settings have been updated');
    } catch (error) {
      logger.error('Failed to save payment settings', { error });
      showErrorToast('Save Failed', 'Could not save payment settings');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showSuccessToast('Copied', `${label} copied to clipboard`);
  };

  const watchAcceptZelle = form.watch('accept_zelle');
  const watchAcceptCashApp = form.watch('accept_cashapp');
  const watchAcceptBitcoin = form.watch('accept_bitcoin');
  const watchAcceptLightning = form.watch('accept_lightning');
  const watchAcceptEthereum = form.watch('accept_ethereum');
  const watchAcceptUsdt = form.watch('accept_usdt');

  // Count enabled methods
  const enabledCount = [
    form.watch('accept_cash'),
    watchAcceptZelle,
    watchAcceptCashApp,
    watchAcceptBitcoin,
    watchAcceptLightning,
    watchAcceptEthereum,
    watchAcceptUsdt,
  ].filter(Boolean).length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {showTitle && (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Payment Methods</h3>
              <p className="text-sm text-muted-foreground">
                Configure which payment methods your customers can use
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {enabledCount} method{enabledCount !== 1 ? 's' : ''} enabled
            </Badge>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="traditional" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Traditional
            </TabsTrigger>
            <TabsTrigger value="crypto" className="flex items-center gap-2">
              <Bitcoin className="h-4 w-4" />
              Cryptocurrency
            </TabsTrigger>
          </TabsList>

          {/* Traditional Payments Tab */}
          <TabsContent value="traditional" className="space-y-4 mt-4">
            {/* Cash */}
            <Card>
              <CardHeader className={compact ? 'pb-2' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Cash</CardTitle>
                      <CardDescription>Accept cash on delivery</CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="accept_cash"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {form.watch('accept_cash') && (
                <CardContent className={compact ? 'pt-0' : ''}>
                  <FormField
                    control={form.control}
                    name="cash_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Please have exact change ready..."
                            className="resize-none"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Instructions shown to customers at checkout
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* Zelle */}
            <Card>
              <CardHeader className={compact ? 'pb-2' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Zelle</CardTitle>
                      <CardDescription>Accept Zelle payments</CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="accept_zelle"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {watchAcceptZelle && (
                <CardContent className={`space-y-4 ${compact ? 'pt-0' : ''}`}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="zelle_username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zelle Email/Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="your@email.com"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="zelle_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zelle Phone (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="(555) 123-4567"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="zelle_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Send to the email above with your order number in the memo..."
                            className="resize-none"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* CashApp */}
            <Card>
              <CardHeader className={compact ? 'pb-2' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">$</span>
                    </div>
                    <div>
                      <CardTitle className="text-base">Cash App</CardTitle>
                      <CardDescription>Accept Cash App payments</CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="accept_cashapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {watchAcceptCashApp && (
                <CardContent className={`space-y-4 ${compact ? 'pt-0' : ''}`}>
                  <FormField
                    control={form.control}
                    name="cashapp_username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cash App Username</FormLabel>
                        <FormControl>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                              $
                            </span>
                            <Input
                              placeholder="YourCashTag"
                              className="rounded-l-none"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cashapp_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Send payment to $YourTag with order number..."
                            className="resize-none"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>
          </TabsContent>

          {/* Cryptocurrency Tab */}
          <TabsContent value="crypto" className="space-y-4 mt-4">
            {/* Bitcoin */}
            <Card>
              <CardHeader className={compact ? 'pb-2' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Bitcoin className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Bitcoin (BTC)</CardTitle>
                      <CardDescription>Accept Bitcoin payments</CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="accept_bitcoin"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {watchAcceptBitcoin && (
                <CardContent className={compact ? 'pt-0' : ''}>
                  <FormField
                    control={form.control}
                    name="bitcoin_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bitcoin Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="bc1q... or 1... or 3..."
                              className="font-mono text-sm pr-10"
                              {...field}
                              value={field.value ?? ''}
                            />
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1 h-7 w-7 p-0"
                                onClick={() => copyToClipboard(field.value ?? '', 'Bitcoin address')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Your Bitcoin wallet address for receiving payments
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* Lightning */}
            <Card>
              <CardHeader className={compact ? 'pb-2' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <Zap className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Lightning Network</CardTitle>
                      <CardDescription>Accept instant Bitcoin payments</CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="accept_lightning"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {watchAcceptLightning && (
                <CardContent className={compact ? 'pt-0' : ''}>
                  <FormField
                    control={form.control}
                    name="lightning_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lightning Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@getalby.com or LNURL..."
                            className="font-mono text-sm"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Your Lightning address (email-like) or LNURL
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* Ethereum */}
            <Card>
              <CardHeader className={compact ? 'pb-2' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Coins className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Ethereum (ETH)</CardTitle>
                      <CardDescription>Accept Ethereum payments</CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="accept_ethereum"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {watchAcceptEthereum && (
                <CardContent className={compact ? 'pt-0' : ''}>
                  <FormField
                    control={form.control}
                    name="ethereum_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ethereum Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="0x..."
                              className="font-mono text-sm pr-10"
                              {...field}
                              value={field.value ?? ''}
                            />
                            {field.value && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1 h-7 w-7 p-0"
                                onClick={() => copyToClipboard(field.value ?? '', 'Ethereum address')}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Your Ethereum wallet address (also used for USDT)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* USDT */}
            <Card>
              <CardHeader className={compact ? 'pb-2' : ''}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                      <span className="text-lg font-bold text-teal-600 dark:text-teal-400">₮</span>
                    </div>
                    <div>
                      <CardTitle className="text-base">USDT (Tether)</CardTitle>
                      <CardDescription>Accept stablecoin payments</CardDescription>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="accept_usdt"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardHeader>
              {watchAcceptUsdt && (
                <CardContent className={compact ? 'pt-0' : ''}>
                  <FormField
                    control={form.control}
                    name="usdt_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>USDT Address (ERC-20)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="0x... (same as ETH address)"
                            className="font-mono text-sm"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Your USDT address on Ethereum network
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>

            {/* Crypto Instructions */}
            {(watchAcceptBitcoin || watchAcceptLightning || watchAcceptEthereum || watchAcceptUsdt) && (
              <Card>
                <CardHeader className={compact ? 'pb-2' : ''}>
                  <CardTitle className="text-base">Crypto Payment Instructions</CardTitle>
                  <CardDescription>
                    General instructions shown for all cryptocurrency payments
                  </CardDescription>
                </CardHeader>
                <CardContent className={compact ? 'pt-0' : ''}>
                  <FormField
                    control={form.control}
                    name="crypto_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="e.g., Send exact amount shown. Include order number in memo if possible. Payments confirmed after 1 confirmation..."
                            className="resize-none min-h-[100px]"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button type="submit" disabled={saving || isLoading}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Payment Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
export default PaymentSettingsForm;

