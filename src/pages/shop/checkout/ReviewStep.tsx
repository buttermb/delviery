/**
 * ReviewStep
 * Step 4: Review order details before placing
 */

import { motion } from 'framer-motion';

import type { CheckoutData } from './types';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface ReviewStepProps {
  formData: CheckoutData;
  setCurrentStep: (step: number) => void;
  agreeToTerms: boolean;
  setAgreeToTerms: (value: boolean) => void;
  createAccount: boolean;
  storeName: string | undefined;
}

export function ReviewStep({
  formData,
  setCurrentStep,
  agreeToTerms,
  setAgreeToTerms,
  createAccount,
  storeName,
}: ReviewStepProps) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Review Your Order</h2>

      {/* Contact Summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Contact</h3>
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)}>
            Edit
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {formData.firstName} {formData.lastName}<br />
          {formData.email}<br />
          {formData.phone}
          {formData.preferredContact && (
            <>
              <br />
              Preferred contact: {formData.preferredContact.charAt(0).toUpperCase() + formData.preferredContact.slice(1)}
            </>
          )}
          {createAccount && (
            <>
              <br />
              <span className="text-primary">Creating account with this email</span>
            </>
          )}
        </p>
      </div>

      <Separator />

      {/* Fulfillment Summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">
            {formData.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery Address'}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)}>
            Edit
          </Button>
        </div>
        {formData.fulfillmentMethod === 'pickup' ? (
          <p className="text-sm text-muted-foreground">
            Pickup at {storeName || 'store'}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {formData.street}
              {formData.apartment && `, ${formData.apartment}`}<br />
              {formData.city}, {formData.state} {formData.zip}
            </p>
            {formData.deliveryNotes && (
              <p className="text-sm text-muted-foreground mt-2">
                Notes: {formData.deliveryNotes}
              </p>
            )}
          </>
        )}
      </div>

      <Separator />

      {/* Payment Summary */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Payment</h3>
          <Button variant="ghost" size="sm" onClick={() => setCurrentStep(3)}>
            Edit
          </Button>
        </div>
        <p className="text-sm text-muted-foreground capitalize">
          {formData.paymentMethod === 'cash' && 'Cash on Delivery'}
          {formData.paymentMethod === 'venmo' && 'Venmo'}
          {formData.paymentMethod === 'zelle' && 'Zelle'}
          {formData.paymentMethod === 'card' && 'Credit/Debit Card'}
          {!['cash', 'venmo', 'zelle', 'card'].includes(formData.paymentMethod) && formData.paymentMethod}
        </p>
      </div>

      <Separator />

      {/* Terms */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="terms"
          checked={agreeToTerms}
          onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
        />
        <Label htmlFor="terms" className="text-sm text-muted-foreground">
          I agree to the terms and conditions and confirm that my order details are correct.
        </Label>
      </div>
    </motion.div>
  );
}
