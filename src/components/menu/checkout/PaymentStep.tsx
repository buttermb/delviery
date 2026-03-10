import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingCart, ArrowRight, ArrowLeft,
  CreditCard, Check, Copy,
  Shield, Bitcoin, ChevronDown,
} from 'lucide-react';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { formatWeight } from '@/utils/productHelpers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PaymentMethod } from './types';

// Order Summary Recap (read-only, shown on Payment step)
function OrderSummaryRecap() {
  const cartItems = useMenuCartStore((state) => state.items);
  const getTotal = useMenuCartStore((state) => state.getTotal);
  const getItemCount = useMenuCartStore((state) => state.getItemCount);
  const [isOpen, setIsOpen] = useState(false);

  const subtotal = getTotal();
  const itemCount = getItemCount();
  const serviceFee = subtotal * 0.05;
  const total = subtotal + serviceFee;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-muted/30 border-dashed">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">
                Order Summary ({itemCount} {itemCount === 1 ? 'item' : 'items'})
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary text-sm">${total.toFixed(2)}</span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-4 space-y-2">
            {cartItems.map((item) => (
              <div key={`${item.productId}-${item.weight}`} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate mr-2">
                  {item.quantity}x {item.productName}
                  {item.weight && ` (${formatWeight(item.weight)})`}
                </span>
                <span className="shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 border-t space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Service fee (5%)</span>
                <span>${serviceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                <span>Total</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Payment Step with Crypto
export function PaymentStep({
  formData,
  totalAmount,
  onUpdate,
  onNext,
  onBack,
  paymentMethods,
  isLoadingSettings
}: {
  formData: { paymentMethod: string };
  totalAmount: number;
  onUpdate: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  paymentMethods: PaymentMethod[];
  isLoadingSettings?: boolean;
}) {
  const [copiedAddress, setCopiedAddress] = useState(false);
  const selectedMethod = paymentMethods.find(m => m.id === formData.paymentMethod);
  const isValid = !!formData.paymentMethod;

  const traditionalMethods = paymentMethods.filter(m => m.category === 'traditional');
  const cryptoMethods = paymentMethods.filter(m => m.category === 'crypto');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(true);
    toast.success('Address copied!');
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  // Mock BTC price for conversion
  const btcPrice = 43500;
  const ethPrice = 2250;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="text-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Payment Method</h2>
          <p className="text-sm text-muted-foreground">Choose how you'd like to pay</p>
        </div>

        {/* Order Summary Recap */}
        <OrderSummaryRecap />

        {/* Loading state */}
        {isLoadingSettings && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {/* Traditional payments */}
        {!isLoadingSettings && traditionalMethods.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Traditional
            </h3>
            <div className="space-y-2">
              {traditionalMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = formData.paymentMethod === method.id;

                return (
                  <Card
                    key={method.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => onUpdate('paymentMethod', method.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{method.label}</div>
                        <div className="text-sm text-muted-foreground">{method.description}</div>
                        {method.username && isSelected && (
                          <div className="mt-1 flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {method.username}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(method.username!);
                                toast.success('Copied!');
                              }}
                              aria-label="Copy username"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </CardContent>
                    {/* Show instructions when selected */}
                    {isSelected && method.instructions && (
                      <div className="px-4 pb-4">
                        <Alert>
                          <AlertDescription className="text-sm">
                            {method.instructions}
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Crypto payments */}
        {!isLoadingSettings && cryptoMethods.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Bitcoin className="h-4 w-4" />
              Cryptocurrency
            </h3>
            <div className="space-y-2">
              {cryptoMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = formData.paymentMethod === method.id;

                // Calculate crypto amount
                let cryptoAmount = '';
                if (method.id === 'bitcoin') {
                  cryptoAmount = (totalAmount / btcPrice).toFixed(6) + ' BTC';
                } else if (method.id === 'ethereum') {
                  cryptoAmount = (totalAmount / ethPrice).toFixed(4) + ' ETH';
                } else if (method.id === 'lightning') {
                  cryptoAmount = Math.round(totalAmount / btcPrice * 100000000) + ' sats';
                } else if (method.id === 'usdt') {
                  cryptoAmount = totalAmount.toFixed(2) + ' USDT';
                }

                return (
                  <Card
                    key={method.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      isSelected
                        ? "border-orange-500 bg-orange-500/5 ring-2 ring-orange-500"
                        : "hover:border-orange-500/50"
                    )}
                    onClick={() => onUpdate('paymentMethod', method.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center",
                          isSelected ? "bg-orange-500 text-white" : "bg-orange-500/10 text-orange-500"
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{method.label}</div>
                          <div className="text-sm text-muted-foreground">{method.description}</div>
                          {cryptoAmount && (
                            <Badge variant="outline" className="mt-1 text-orange-600 border-orange-500/30">
                              {'\u2248'} {cryptoAmount}
                            </Badge>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 text-orange-500" />
                        )}
                      </div>

                      {/* Show wallet address for selected crypto */}
                      {isSelected && method.address && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground mb-2">Send to this address:</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs break-all font-mono bg-background p-2 rounded">
                              {method.address}
                            </code>
                            <Button
                              size="icon"
                              variant="outline"
                              className="shrink-0 h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                              copyToClipboard(method.address!);
                            }}
                            aria-label="Copy address"
                          >
                            {copiedAddress ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          </div>
                        </div>
                      )}
                      {/* Show instructions when selected */}
                      {isSelected && method.instructions && (
                        <div className="mt-3 p-2 bg-background rounded text-xs text-muted-foreground">
                          {method.instructions}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Security notice */}
        <Alert className="bg-emerald-500/10 border-emerald-500/20">
          <Shield className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-300">
            Your payment information is encrypted and secure.
            {selectedMethod?.category === 'crypto'
              ? ' Send payment after placing order.'
              : ' Payment collected upon delivery/pickup.'}
          </AlertDescription>
        </Alert>
      </div>

      {/* Bottom buttons */}
      <div className="border-t bg-card px-4 py-4 flex gap-3">
        <Button variant="outline" onClick={onBack} className="h-12 px-6" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 h-12 text-lg font-semibold"
        >
          Review Order
          <ArrowRight className="h-5 w-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
