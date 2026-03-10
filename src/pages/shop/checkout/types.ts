/**
 * Checkout Types & Constants
 * Shared types, interfaces, and constants for the checkout flow
 */

import { User, MapPin, CreditCard, Check } from 'lucide-react';

// Email validation regex
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation - accepts formats: (555) 123-4567, 555-123-4567, 5551234567, +1 555-123-4567
export const PHONE_REGEX = /^[+]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

export interface CheckoutData {
  // Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContact: 'text' | 'phone' | 'email' | 'telegram';
  // Fulfillment
  fulfillmentMethod: 'delivery' | 'pickup';
  // Delivery
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  deliveryNotes: string;
  // Payment
  paymentMethod: string;
}

// Extended store properties beyond base StoreInfo type
export interface DeliveryZone {
  zip_code: string;
  fee?: number;
  min_order?: number;
}

export interface PurchaseLimits {
  enabled?: boolean;
  max_per_order?: number;
  max_daily?: number;
  max_weekly?: number;
}

export interface GiftCardValidationResult {
  is_valid: boolean;
  current_balance: number;
  message: string;
}

export interface OrderResult {
  order_id: string;
  order_number: string;
  tracking_token?: string;
  total?: number;
  checkoutUrl?: string;
  telegramLink?: string;
}

export interface UnavailableProduct {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}

export class OutOfStockError extends Error {
  unavailableProducts: UnavailableProduct[];
  constructor(unavailableProducts: UnavailableProduct[]) {
    const names = unavailableProducts.map(p => p.productName).join(', ');
    super(`Some items are out of stock: ${names}`);
    this.name = 'OutOfStockError';
    this.unavailableProducts = unavailableProducts;
  }
}

// Helper type for calling untyped Supabase RPCs
export type SupabaseRpc = (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;

export const STEPS = [
  { id: 1, name: 'Contact', icon: User },
  { id: 2, name: 'Delivery', icon: MapPin },
  { id: 3, name: 'Payment', icon: CreditCard },
  { id: 4, name: 'Review', icon: Check },
] as const;

export const INITIAL_FORM_DATA: CheckoutData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  preferredContact: 'text',
  fulfillmentMethod: 'delivery',
  street: '',
  apartment: '',
  city: '',
  state: '',
  zip: '',
  deliveryNotes: '',
  paymentMethod: 'cash',
};
