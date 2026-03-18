/**
 * CheckoutPage Tests
 * Tests for form validation, delivery fee calculation, totals, and order flow
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// Extracted validation functions (mirroring CheckoutPage logic)
// ============================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

interface CheckoutData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  deliveryNotes: string;
  paymentMethod: string;
}

interface StoreConfig {
  id: string;
  free_delivery_threshold: number;
  default_delivery_fee: number;
  delivery_zones: Array<{ zip_code: string; fee: number; min_order?: number }>;
  checkout_settings?: { require_phone?: boolean };
  payment_methods: string[];
  enable_cart_rounding?: boolean;
  minimum_order_amount?: number;
  purchase_limits?: {
    enabled: boolean;
    max_per_order?: number;
    max_daily?: number;
    max_weekly?: number;
  };
}

function validateContactStep(
  formData: CheckoutData,
  store: StoreConfig
): { valid: boolean; error?: string } {
  if (!formData.firstName || !formData.lastName || !formData.email) {
    return { valid: false, error: 'Please fill in all required fields' };
  }
  if (!EMAIL_REGEX.test(formData.email)) {
    return { valid: false, error: 'Invalid email address' };
  }
  if (store.checkout_settings?.require_phone && !formData.phone) {
    return { valid: false, error: 'Phone number is required' };
  }
  if (formData.phone && !PHONE_REGEX.test(formData.phone.replace(/\s/g, ''))) {
    return { valid: false, error: 'Invalid phone number' };
  }
  return { valid: true };
}

function validateDeliveryStep(
  formData: CheckoutData,
  store: StoreConfig,
  subtotal: number
): { valid: boolean; error?: string } {
  if (!formData.street || !formData.city || !formData.zip) {
    return { valid: false, error: 'Please fill in your delivery address' };
  }

  const deliveryZones = store.delivery_zones ?? [];
  if (deliveryZones.length > 0) {
    const matchingZone = deliveryZones.find((zone) => zone.zip_code === formData.zip);
    if (!matchingZone) {
      return { valid: false, error: `We don't currently deliver to zip code ${formData.zip}` };
    }
    if (matchingZone.min_order && subtotal < matchingZone.min_order) {
      return { valid: false, error: `Minimum order of $${matchingZone.min_order} required` };
    }
  }
  return { valid: true };
}

function validatePaymentStep(formData: CheckoutData): { valid: boolean; error?: string } {
  if (!formData.paymentMethod) {
    return { valid: false, error: 'Please select a payment method' };
  }
  return { valid: true };
}

function validateReviewStep(agreeToTerms: boolean): { valid: boolean; error?: string } {
  if (!agreeToTerms) {
    return { valid: false, error: 'Please agree to the terms to continue' };
  }
  return { valid: true };
}

function getDeliveryFee(
  store: StoreConfig,
  subtotal: number,
  zip: string,
  freeShipping = false
): number {
  if (freeShipping) return 0;
  if (subtotal >= store.free_delivery_threshold) return 0;

  const deliveryZones = store.delivery_zones ?? [];
  const matchingZone = deliveryZones.find((zone) => zone.zip_code === zip);

  if (matchingZone) {
    return matchingZone.fee;
  }

  return store.default_delivery_fee;
}

function calculateTotal(
  subtotal: number,
  deliveryFee: number,
  couponDiscount: number,
  dealsDiscount: number,
  loyaltyDiscount: number,
  giftCardAmount: number,
  enableCartRounding = false
): { total: number; roundingAdjustment: number } {
  const rawTotal = Math.max(0, subtotal + deliveryFee - loyaltyDiscount - dealsDiscount - couponDiscount);
  const totalBeforeGiftCards = enableCartRounding ? Math.round(rawTotal) : rawTotal;
  const roundingAdjustment = enableCartRounding ? (totalBeforeGiftCards - rawTotal) : 0;
  const total = Math.max(0, totalBeforeGiftCards - giftCardAmount);
  return { total, roundingAdjustment };
}

function validatePurchaseLimits(
  store: StoreConfig,
  total: number,
  dailyTotal: number,
  weeklyTotal: number
): { valid: boolean; error?: string } {
  const limits = store.purchase_limits;
  if (!limits?.enabled) return { valid: true };

  if (limits.max_per_order && total > limits.max_per_order) {
    return { valid: false, error: `Order exceeds maximum limit of $${limits.max_per_order}` };
  }

  if (limits.max_daily && (dailyTotal + total) > limits.max_daily) {
    return { valid: false, error: `Daily purchase limit of $${limits.max_daily} reached` };
  }

  if (limits.max_weekly && (weeklyTotal + total) > limits.max_weekly) {
    return { valid: false, error: `Weekly purchase limit of $${limits.max_weekly} reached` };
  }

  return { valid: true };
}

// ============================================================
// Tests
// ============================================================

const defaultStore: StoreConfig = {
  id: 'store-123',
  free_delivery_threshold: 100,
  default_delivery_fee: 5,
  delivery_zones: [],
  payment_methods: ['cash', 'card'],
};

const storeWithZones: StoreConfig = {
  ...defaultStore,
  delivery_zones: [
    { zip_code: '10001', fee: 5, min_order: 20 },
    { zip_code: '10002', fee: 8 },
    { zip_code: '10003', fee: 0 },
  ],
};

const validFormData: CheckoutData = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '5551234567',
  street: '123 Main St',
  apartment: 'Apt 4B',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  deliveryNotes: 'Ring doorbell',
  paymentMethod: 'cash',
};

describe('CheckoutPage Validation', () => {
  describe('Contact Information (Step 1)', () => {
    it('should pass with valid contact data', () => {
      const result = validateContactStep(validFormData, defaultStore);
      expect(result.valid).toBe(true);
    });

    it('should fail when firstName is empty', () => {
      const result = validateContactStep(
        { ...validFormData, firstName: '' },
        defaultStore
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required fields');
    });

    it('should fail when lastName is empty', () => {
      const result = validateContactStep(
        { ...validFormData, lastName: '' },
        defaultStore
      );
      expect(result.valid).toBe(false);
    });

    it('should fail when email is empty', () => {
      const result = validateContactStep(
        { ...validFormData, email: '' },
        defaultStore
      );
      expect(result.valid).toBe(false);
    });

    it('should fail with invalid email format', () => {
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
        'no@.com',
      ];

      for (const email of invalidEmails) {
        const result = validateContactStep(
          { ...validFormData, email },
          defaultStore
        );
        expect(result.valid).toBe(false);
      }
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'simple@example.com',
        'user+tag@domain.org',
        'first.last@company.co.uk',
        'email123@test.io',
      ];

      for (const email of validEmails) {
        const result = validateContactStep(
          { ...validFormData, email },
          defaultStore
        );
        expect(result.valid).toBe(true);
      }
    });

    it('should require phone when store setting is enabled', () => {
      const storeRequiresPhone: StoreConfig = {
        ...defaultStore,
        checkout_settings: { require_phone: true },
      };

      const result = validateContactStep(
        { ...validFormData, phone: '' },
        storeRequiresPhone
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Phone');
    });

    it('should not require phone when store setting is disabled', () => {
      const result = validateContactStep(
        { ...validFormData, phone: '' },
        defaultStore
      );
      expect(result.valid).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = ['abc', '123', '555', 'not-a-phone'];

      for (const phone of invalidPhones) {
        const result = validateContactStep(
          { ...validFormData, phone },
          defaultStore
        );
        expect(result.valid).toBe(false);
      }
    });

    it('should accept valid phone formats', () => {
      const validPhones = [
        '5551234567',
        '555-123-4567',
        '(555)123-4567',
        '+15551234567',
      ];

      for (const phone of validPhones) {
        const result = validateContactStep(
          { ...validFormData, phone },
          defaultStore
        );
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Delivery Address (Step 2)', () => {
    it('should pass with valid delivery address', () => {
      const result = validateDeliveryStep(validFormData, defaultStore, 50);
      expect(result.valid).toBe(true);
    });

    it('should fail when street is empty', () => {
      const result = validateDeliveryStep(
        { ...validFormData, street: '' },
        defaultStore,
        50
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('delivery address');
    });

    it('should fail when city is empty', () => {
      const result = validateDeliveryStep(
        { ...validFormData, city: '' },
        defaultStore,
        50
      );
      expect(result.valid).toBe(false);
    });

    it('should fail when zip is empty', () => {
      const result = validateDeliveryStep(
        { ...validFormData, zip: '' },
        defaultStore,
        50
      );
      expect(result.valid).toBe(false);
    });

    it('should allow any zip when no delivery zones configured', () => {
      const result = validateDeliveryStep(
        { ...validFormData, zip: '99999' },
        defaultStore,
        50
      );
      expect(result.valid).toBe(true);
    });

    it('should reject zip not in configured delivery zones', () => {
      const result = validateDeliveryStep(
        { ...validFormData, zip: '99999' },
        storeWithZones,
        50
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("don't currently deliver");
    });

    it('should accept zip in configured delivery zones', () => {
      const result = validateDeliveryStep(
        { ...validFormData, zip: '10001' },
        storeWithZones,
        50
      );
      expect(result.valid).toBe(true);
    });

    it('should reject order below zone minimum', () => {
      const result = validateDeliveryStep(
        { ...validFormData, zip: '10001' },
        storeWithZones,
        15 // min_order is 20 for zip 10001
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Minimum order');
    });

    it('should accept order meeting zone minimum', () => {
      const result = validateDeliveryStep(
        { ...validFormData, zip: '10001' },
        storeWithZones,
        20
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('Payment Method (Step 3)', () => {
    it('should pass with payment method selected', () => {
      const result = validatePaymentStep(validFormData);
      expect(result.valid).toBe(true);
    });

    it('should fail with no payment method', () => {
      const result = validatePaymentStep(
        { ...validFormData, paymentMethod: '' }
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('payment method');
    });
  });

  describe('Review & Terms (Step 4)', () => {
    it('should pass when terms agreed', () => {
      const result = validateReviewStep(true);
      expect(result.valid).toBe(true);
    });

    it('should fail when terms not agreed', () => {
      const result = validateReviewStep(false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terms');
    });
  });

  describe('Delivery Fee Calculation', () => {
    it('should return 0 when subtotal exceeds free delivery threshold', () => {
      const fee = getDeliveryFee(defaultStore, 150, '10001');
      expect(fee).toBe(0);
    });

    it('should return default fee when below threshold (no zones)', () => {
      const fee = getDeliveryFee(defaultStore, 50, '10001');
      expect(fee).toBe(5);
    });

    it('should return zone-specific fee for matching zip', () => {
      const fee = getDeliveryFee(storeWithZones, 50, '10002');
      expect(fee).toBe(8);
    });

    it('should return free delivery for zone with 0 fee', () => {
      const fee = getDeliveryFee(storeWithZones, 50, '10003');
      expect(fee).toBe(0);
    });

    it('should return default fee when zip not in zones', () => {
      const fee = getDeliveryFee(storeWithZones, 50, '99999');
      expect(fee).toBe(5);
    });

    it('should return 0 when free shipping coupon applied', () => {
      const fee = getDeliveryFee(defaultStore, 50, '10001', true);
      expect(fee).toBe(0);
    });

    it('should apply free delivery at exact threshold', () => {
      const fee = getDeliveryFee(defaultStore, 100, '10001');
      expect(fee).toBe(0);
    });
  });

  describe('Total Calculation', () => {
    it('should calculate basic total (subtotal + delivery)', () => {
      const { total } = calculateTotal(50, 5, 0, 0, 0, 0);
      expect(total).toBe(55);
    });

    it('should subtract coupon discount', () => {
      const { total } = calculateTotal(50, 5, 10, 0, 0, 0);
      expect(total).toBe(45);
    });

    it('should subtract deals discount', () => {
      const { total } = calculateTotal(50, 5, 0, 15, 0, 0);
      expect(total).toBe(40);
    });

    it('should subtract loyalty discount', () => {
      const { total } = calculateTotal(50, 5, 0, 0, 5, 0);
      expect(total).toBe(50);
    });

    it('should subtract gift card amount', () => {
      const { total } = calculateTotal(50, 5, 0, 0, 0, 20);
      expect(total).toBe(35);
    });

    it('should never go below 0', () => {
      const { total } = calculateTotal(10, 0, 50, 50, 50, 100);
      expect(total).toBe(0);
    });

    it('should apply all discounts correctly', () => {
      // subtotal:50, delivery:5, coupon:5, deals:10, loyalty:3, gift:10
      // rawTotal = max(0, 50 + 5 - 3 - 10 - 5) = 37
      // total = max(0, 37 - 10) = 27
      const { total } = calculateTotal(50, 5, 5, 10, 3, 10);
      expect(total).toBe(27);
    });

    it('should round to nearest dollar when enabled', () => {
      // rawTotal = 50 + 5 - 0 = 55.49
      const { total, roundingAdjustment } = calculateTotal(50.49, 5, 0, 0, 0, 0, true);
      expect(total).toBe(55); // rounded down
      expect(roundingAdjustment).toBeCloseTo(-0.49, 2);
    });

    it('should round up when appropriate', () => {
      const { total } = calculateTotal(50.51, 5, 0, 0, 0, 0, true);
      expect(total).toBe(56); // rounded up
    });

    it('should not round when disabled', () => {
      const { total, roundingAdjustment } = calculateTotal(50.49, 5, 0, 0, 0, 0, false);
      expect(total).toBeCloseTo(55.49, 2);
      expect(roundingAdjustment).toBe(0);
    });
  });

  describe('Purchase Limits', () => {
    const storeWithLimits: StoreConfig = {
      ...defaultStore,
      purchase_limits: {
        enabled: true,
        max_per_order: 500,
        max_daily: 1000,
        max_weekly: 3000,
      },
    };

    it('should pass when under all limits', () => {
      const result = validatePurchaseLimits(storeWithLimits, 100, 0, 0);
      expect(result.valid).toBe(true);
    });

    it('should fail when order exceeds per-order max', () => {
      const result = validatePurchaseLimits(storeWithLimits, 600, 0, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('$500');
    });

    it('should fail when daily total would be exceeded', () => {
      const result = validatePurchaseLimits(storeWithLimits, 200, 900, 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Daily');
    });

    it('should fail when weekly total would be exceeded', () => {
      const result = validatePurchaseLimits(storeWithLimits, 200, 0, 2900);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Weekly');
    });

    it('should skip validation when limits not enabled', () => {
      const store: StoreConfig = {
        ...defaultStore,
        purchase_limits: { enabled: false, max_per_order: 10 },
      };
      const result = validatePurchaseLimits(store, 10000, 0, 0);
      expect(result.valid).toBe(true);
    });

    it('should skip validation when no purchase_limits defined', () => {
      const result = validatePurchaseLimits(defaultStore, 10000, 0, 0);
      expect(result.valid).toBe(true);
    });
  });

  describe('Minimum Order Validation', () => {
    it('should detect under-minimum orders', () => {
      const store: StoreConfig = { ...defaultStore, minimum_order_amount: 25 };
      const subtotal = 20;
      const isUnderMinimum = store.minimum_order_amount! > 0 && subtotal < store.minimum_order_amount!;
      expect(isUnderMinimum).toBe(true);
    });

    it('should pass when order meets minimum', () => {
      const store: StoreConfig = { ...defaultStore, minimum_order_amount: 25 };
      const subtotal = 25;
      const isUnderMinimum = store.minimum_order_amount! > 0 && subtotal < store.minimum_order_amount!;
      expect(isUnderMinimum).toBe(false);
    });

    it('should pass when no minimum set', () => {
      const subtotal = 5;
      const minimumOrderAmount = defaultStore.minimum_order_amount || 0;
      const isUnderMinimum = minimumOrderAmount > 0 && subtotal < minimumOrderAmount;
      expect(isUnderMinimum).toBe(false);
    });
  });

  describe('Order Item Formatting', () => {
    it('should format cart items for order submission', () => {
      const cartItems = [
        { productId: 'prod-1', name: 'Widget', quantity: 2, price: 10, imageUrl: 'img.jpg', variant: '1/8' },
        { productId: 'prod-2', name: 'Gadget', quantity: 1, price: 25, imageUrl: null },
      ];

      const orderItems = cartItems.map((item) => ({
        product_id: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image_url: item.imageUrl,
      }));

      expect(orderItems).toHaveLength(2);
      expect(orderItems[0].product_id).toBe('prod-1');
      expect(orderItems[0].quantity).toBe(2);
      expect(orderItems[1].image_url).toBeNull();
    });

    it('should format delivery address correctly', () => {
      const formData = validFormData;
      const deliveryAddress = `${formData.street}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}, ${formData.state} ${formData.zip}`;

      expect(deliveryAddress).toBe('123 Main St, Apt 4B, New York, NY 10001');
    });

    it('should handle missing apartment in delivery address', () => {
      const formData = { ...validFormData, apartment: '' };
      const deliveryAddress = `${formData.street}${formData.apartment ? ', ' + formData.apartment : ''}, ${formData.city}, ${formData.state} ${formData.zip}`;

      expect(deliveryAddress).toBe('123 Main St, New York, NY 10001');
    });
  });

  describe('Idempotency Key', () => {
    it('should generate unique keys', () => {
      const key1 = `order_${crypto.randomUUID()}`;
      const key2 = `order_${crypto.randomUUID()}`;
      expect(key1).not.toBe(key2);
      expect(key1.startsWith('order_')).toBe(true);
    });
  });
});
