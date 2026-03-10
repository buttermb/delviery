/**
 * FulfillmentStep
 * Step 2: Delivery/Pickup method and address fields
 */

import { motion } from 'framer-motion';
import { Truck, Store } from 'lucide-react';

import type { CheckoutData } from './types';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckoutAddressAutocomplete } from '@/components/shop/CheckoutAddressAutocomplete';

interface FulfillmentStepProps {
  formData: CheckoutData;
  updateField: (field: keyof CheckoutData, value: string) => void;
  storeName: string | undefined;
  showDeliveryNotes: boolean;
}

export function FulfillmentStep({
  formData,
  updateField,
  storeName,
  showDeliveryNotes,
}: FulfillmentStepProps) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">How would you like to receive your order?</h2>

      {/* Fulfillment Method Selector */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
            formData.fulfillmentMethod === 'delivery'
              ? 'border-primary bg-primary/5 ring-2 ring-primary'
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => updateField('fulfillmentMethod', 'delivery')}
        >
          <Truck className="h-6 w-6" />
          <span className="font-semibold">Delivery</span>
          <span className="text-xs text-muted-foreground">We deliver to you</span>
        </button>
        <button
          type="button"
          className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
            formData.fulfillmentMethod === 'pickup'
              ? 'border-primary bg-primary/5 ring-2 ring-primary'
              : 'border-border hover:border-primary/50'
          }`}
          onClick={() => updateField('fulfillmentMethod', 'pickup')}
        >
          <Store className="h-6 w-6" />
          <span className="font-semibold">Pickup</span>
          <span className="text-xs text-muted-foreground">Pick up at store</span>
        </button>
      </div>

      {/* Pickup Info */}
      {formData.fulfillmentMethod === 'pickup' && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Store className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-semibold">Pickup at {storeName || 'our store'}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You will receive pickup details after your order is confirmed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Address fields -- only shown for delivery */}
      {formData.fulfillmentMethod === 'delivery' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="street">Street Address *</Label>
            <CheckoutAddressAutocomplete
              defaultValue={formData.street}
              placeholder="Start typing your address..."
              onAddressSelect={(address) => {
                updateField('street', address.street);
                updateField('city', address.city);
                updateField('state', address.state);
                updateField('zip', address.zip);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apartment">Apartment, Suite, etc. (Optional)</Label>
            <Input
              id="apartment"
              name="apartment"
              value={formData.apartment}
              onChange={(e) => updateField('apartment', e.target.value)}
              placeholder="Apt 4B"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                name="city"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="New York"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                name="state"
                value={formData.state}
                onChange={(e) => updateField('state', e.target.value)}
                placeholder="NY"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">ZIP Code *</Label>
            <Input
              id="zip"
              name="zip"
              value={formData.zip}
              onChange={(e) => updateField('zip', e.target.value)}
              placeholder="10001"
            />
          </div>
          {showDeliveryNotes && (
            <div className="space-y-2">
              <Label htmlFor="deliveryNotes">Delivery Instructions (Optional)</Label>
              <Textarea
                id="deliveryNotes"
                value={formData.deliveryNotes}
                onChange={(e) => updateField('deliveryNotes', e.target.value)}
                placeholder="Ring doorbell, leave at door, etc."
                rows={3}
              />
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
