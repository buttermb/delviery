/**
 * PaymentMethodStep
 * Step 3 of checkout: payment method selection
 * Supports Cash, Venmo, Zelle, CashApp, and Stripe (card)
 */

import { useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Copy,
  Banknote,
  CreditCard,
  Smartphone,
  DollarSign,
} from 'lucide-react';

/** Checkout settings stored on the marketplace_stores row */
interface CheckoutSettings {
  venmo_handle?: string;
  zelle_email?: string;
  zelle_phone?: string;
  cashapp_username?: string;
  cash_instructions?: string;
  venmo_instructions?: string;
  zelle_instructions?: string;
  cashapp_instructions?: string;
}

interface PaymentMethodStepProps {
  /** Enabled payment methods from store settings (e.g. ['cash', 'venmo', 'zelle', 'card']) */
  paymentMethods: string[];
  /** Currently selected method */
  selectedMethod: string;
  /** Callback when method changes */
  onMethodChange: (method: string) => void;
  /** Whether Stripe is configured for this store */
  isStripeConfigured: boolean | undefined;
  /** Store checkout settings with payment handles/addresses */
  checkoutSettings?: CheckoutSettings;
  /** Venmo confirmation state */
  venmoConfirmed: boolean;
  onVenmoConfirmedChange: (confirmed: boolean) => void;
  /** Zelle confirmation state */
  zelleConfirmed: boolean;
  onZelleConfirmedChange: (confirmed: boolean) => void;
}

/** Map method key → display label */
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Credit / Debit Card',
  venmo: 'Venmo',
  zelle: 'Zelle',
  cashapp: 'Cash App',
  paypal: 'PayPal',
  bitcoin: 'Bitcoin',
};

/** Map method key → icon component */
const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  venmo: Smartphone,
  zelle: DollarSign,
  cashapp: DollarSign,
  paypal: CreditCard,
  bitcoin: CreditCard,
};

function getMethodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method.charAt(0).toUpperCase() + method.slice(1);
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied!`);
}

export function PaymentMethodStep({
  paymentMethods,
  selectedMethod,
  onMethodChange,
  isStripeConfigured,
  checkoutSettings,
  venmoConfirmed,
  onVenmoConfirmedChange,
  zelleConfirmed,
  onZelleConfirmedChange,
}: PaymentMethodStepProps) {
  // Filter out card if Stripe is not configured
  const availableMethods = paymentMethods.filter(
    (method) => method !== 'card' || isStripeConfigured !== false
  );

  // Auto-select when only one method is available
  useEffect(() => {
    if (availableMethods.length === 1 && selectedMethod !== availableMethods[0]) {
      onMethodChange(availableMethods[0]);
    }
  }, [availableMethods, selectedMethod, onMethodChange]);

  const handleMethodChange = (value: string) => {
    onMethodChange(value);
    if (value !== 'venmo') onVenmoConfirmedChange(false);
    if (value !== 'zelle') onZelleConfirmedChange(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Payment Method</h2>

      {/* Single-method notice */}
      {availableMethods.length === 1 && (
        <p className="text-sm text-muted-foreground">
          This store accepts <strong>{getMethodLabel(availableMethods[0])}</strong>.
        </p>
      )}

      {/* Payment method selector */}
      <RadioGroup
        value={selectedMethod}
        onValueChange={handleMethodChange}
        className="space-y-2 sm:space-y-3"
      >
        {availableMethods.map((method) => {
          const Icon = METHOD_ICONS[method] ?? CreditCard;
          return (
            <label
              key={method}
              htmlFor={`pay-${method}`}
              className={`flex items-center gap-3 p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors w-full ${
                selectedMethod === method
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value={method} id={`pay-${method}`} />
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium text-sm">{getMethodLabel(method)}</span>
            </label>
          );
        })}
      </RadioGroup>

      {/* Cash details */}
      {selectedMethod === 'cash' && checkoutSettings?.cash_instructions && (
        <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
          {checkoutSettings.cash_instructions}
        </div>
      )}

      {/* Venmo details */}
      {selectedMethod === 'venmo' && (
        <PaymentConfirmationBlock
          handle={checkoutSettings?.venmo_handle}
          handleLabel="Venmo handle"
          instructions={checkoutSettings?.venmo_instructions}
          sendLabel="Send payment to"
          copyLabel="Copy Venmo handle"
          confirmLabel="I've sent payment via Venmo"
          confirmed={venmoConfirmed}
          onConfirmedChange={onVenmoConfirmedChange}
          confirmId="venmo-confirmed"
        />
      )}

      {/* Zelle details */}
      {selectedMethod === 'zelle' && (
        <PaymentConfirmationBlock
          handle={checkoutSettings?.zelle_email || checkoutSettings?.zelle_phone}
          handleLabel="Zelle contact"
          instructions={checkoutSettings?.zelle_instructions}
          sendLabel="Send Zelle payment to"
          copyLabel="Copy Zelle contact"
          confirmLabel="I've sent payment via Zelle"
          confirmed={zelleConfirmed}
          onConfirmedChange={onZelleConfirmedChange}
          confirmId="zelle-confirmed"
        />
      )}

      {/* CashApp details */}
      {selectedMethod === 'cashapp' && checkoutSettings?.cashapp_username && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Send payment to{' '}
              <span className="font-bold">{checkoutSettings.cashapp_username}</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                copyToClipboard(checkoutSettings.cashapp_username!, 'Cash App username')
              }
            >
              <Copy className="h-3 w-3" />
              Copy Cash App username
            </Button>
          </div>
          {checkoutSettings.cashapp_instructions && (
            <p className="text-sm text-muted-foreground">{checkoutSettings.cashapp_instructions}</p>
          )}
        </div>
      )}

      {/* Card (Stripe) — note shown below selection */}
      {selectedMethod === 'card' && (
        <div className="p-4 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
          You will be redirected to a secure payment page to complete your card payment after placing the order.
        </div>
      )}
    </div>
  );
}

/** Reusable block for Venmo/Zelle payment confirmation with handle + checkbox */
interface PaymentConfirmationBlockProps {
  handle?: string;
  handleLabel: string;
  instructions?: string;
  sendLabel: string;
  copyLabel: string;
  confirmLabel: string;
  confirmed: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  confirmId: string;
}

function PaymentConfirmationBlock({
  handle,
  handleLabel,
  instructions,
  sendLabel,
  copyLabel,
  confirmLabel,
  confirmed,
  onConfirmedChange,
  confirmId,
}: PaymentConfirmationBlockProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      {handle && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {sendLabel}{' '}
            <span className="font-bold">{handle}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => copyToClipboard(handle, handleLabel)}
          >
            <Copy className="h-3 w-3" />
            {copyLabel}
          </Button>
        </div>
      )}
      {instructions && (
        <p className="text-sm text-muted-foreground">{instructions}</p>
      )}
      <div className="flex items-start gap-2 pt-2">
        <Checkbox
          id={confirmId}
          checked={confirmed}
          onCheckedChange={(checked) => onConfirmedChange(checked as boolean)}
        />
        <Label htmlFor={confirmId} className="text-sm cursor-pointer">
          {confirmLabel}
        </Label>
      </div>
    </div>
  );
}

export default PaymentMethodStep;
