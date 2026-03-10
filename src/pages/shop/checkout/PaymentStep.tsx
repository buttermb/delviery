/**
 * PaymentStep
 * Step 3: Payment method selection with Venmo/Zelle confirmation
 */

import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

import type { CheckoutData } from './types';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';

const ExpressPaymentButtons = lazy(() => import('@/components/shop/ExpressPaymentButtons'));

interface PaymentStepProps {
  formData: CheckoutData;
  updateField: (field: keyof CheckoutData, value: string) => void;
  paymentMethods: string[];
  isStripeConfigured: boolean | undefined;
  venmoConfirmed: boolean;
  setVenmoConfirmed: (value: boolean) => void;
  zelleConfirmed: boolean;
  setZelleConfirmed: (value: boolean) => void;
  venmoHandle: string | undefined;
  zelleEmail: string | undefined;
}

export function PaymentStep({
  formData,
  updateField,
  paymentMethods,
  isStripeConfigured,
  venmoConfirmed,
  setVenmoConfirmed,
  zelleConfirmed,
  setZelleConfirmed,
  venmoHandle,
  zelleEmail,
}: PaymentStepProps) {
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Payment Method</h2>

      {/* Express Payment Options -- lazy-loaded */}
      <Suspense fallback={null}>
        <div className="space-y-4">
          <ExpressPaymentButtons
            showDivider={true}
            size="lg"
          />
        </div>
      </Suspense>

      {/* Standard Payment Methods */}
      <RadioGroup
        value={formData.paymentMethod}
        onValueChange={(value) => {
          updateField('paymentMethod', value);
          if (value !== 'venmo') setVenmoConfirmed(false);
          if (value !== 'zelle') setZelleConfirmed(false);
        }}
        className="space-y-2 sm:space-y-3"
      >
        {paymentMethods.filter((method: string) =>
          method !== 'card' || isStripeConfigured !== false
        ).map((method: string) => (
          <div
            key={method}
            className="flex items-center space-x-3 p-3 sm:p-4 border rounded-lg cursor-pointer hover:bg-muted/50 w-full"
            onClick={() => {
              updateField('paymentMethod', method);
              if (method !== 'venmo') setVenmoConfirmed(false);
              if (method !== 'zelle') setZelleConfirmed(false);
            }}
          >
            <RadioGroupItem value={method} id={method} />
            <Label htmlFor={method} className="flex-1 cursor-pointer capitalize">
              {method === 'cash' && 'Cash on Delivery'}
              {method === 'card' && 'Credit/Debit Card'}
              {method === 'paypal' && 'PayPal'}
              {method === 'bitcoin' && 'Bitcoin'}
              {method === 'venmo' && 'Venmo'}
              {method === 'zelle' && 'Zelle'}
              {!['cash', 'card', 'paypal', 'bitcoin', 'venmo', 'zelle'].includes(method) && method}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {/* Venmo payment details */}
      {formData.paymentMethod === 'venmo' && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          {venmoHandle && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Send payment to{' '}
                <span className="font-bold">{venmoHandle}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(venmoHandle);
                  toast.success('Venmo handle copied!');
                }}
              >
                <Copy className="h-3 w-3" />
                Copy Venmo handle
              </Button>
            </div>
          )}
          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="venmo-confirmed"
              checked={venmoConfirmed}
              onCheckedChange={(checked) => setVenmoConfirmed(checked as boolean)}
            />
            <Label htmlFor="venmo-confirmed" className="text-sm cursor-pointer">
              I&apos;ve sent payment via Venmo
            </Label>
          </div>
        </div>
      )}

      {/* Zelle payment details */}
      {formData.paymentMethod === 'zelle' && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          {zelleEmail && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Send Zelle payment to{' '}
                <span className="font-bold">{zelleEmail}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(zelleEmail);
                  toast.success('Zelle contact copied!');
                }}
              >
                <Copy className="h-3 w-3" />
                Copy Zelle contact
              </Button>
            </div>
          )}
          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="zelle-confirmed"
              checked={zelleConfirmed}
              onCheckedChange={(checked) => setZelleConfirmed(checked as boolean)}
            />
            <Label htmlFor="zelle-confirmed" className="text-sm cursor-pointer">
              I&apos;ve sent payment via Zelle
            </Label>
          </div>
        </div>
      )}
    </motion.div>
  );
}
