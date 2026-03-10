import {
  ShoppingCart, User, MapPin, CreditCard, Check,
  Truck, Store, Banknote, Wallet, Bitcoin, Zap, Coins,
} from 'lucide-react';
import type { PaymentSettings } from '@/hooks/usePaymentSettings';

export interface CheckoutFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string;
  tenantId?: string;
  accessToken?: string;
  minOrder?: number;
  maxOrder?: number;
  onOrderComplete: (orderId?: string, orderTotal?: number) => void;
  products?: Array<{ id: string; name: string; image_url?: string }>;
}

export type CheckoutStep = 'cart' | 'details' | 'location' | 'payment' | 'confirm';

export const STEPS: { id: CheckoutStep; label: string; icon: React.ElementType }[] = [
  { id: 'cart', label: 'Cart', icon: ShoppingCart },
  { id: 'details', label: 'Details', icon: User },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'confirm', label: 'Confirm', icon: Check },
];

export const DELIVERY_METHODS = [
  { id: 'delivery', label: 'Delivery', icon: Truck, description: 'We deliver to your location', eta: '30-60 min' },
  { id: 'pickup', label: 'Pickup', icon: Store, description: 'Pick up at our location', eta: '15-20 min' },
];

// Payment method type
export type PaymentMethod = {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  category: 'traditional' | 'crypto';
  apiValue: 'cash' | 'card' | 'crypto' | 'other';
  address?: string;
  username?: string;
  instructions?: string;
};

// Default payment methods (used as fallback when settings not loaded)
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cash', label: 'Cash', icon: Banknote, description: 'Pay on delivery/pickup', category: 'traditional', apiValue: 'cash' },
];

// Build payment methods from settings
export function buildPaymentMethods(settings: PaymentSettings | null | undefined): PaymentMethod[] {
  const methods: PaymentMethod[] = [];

  if (!settings) {
    // Return default cash if no settings
    return DEFAULT_PAYMENT_METHODS;
  }

  // Traditional payments
  if (settings.accept_cash) {
    methods.push({
      id: 'cash',
      label: 'Cash',
      icon: Banknote,
      description: settings.cash_instructions || 'Pay on delivery/pickup',
      category: 'traditional',
      apiValue: 'cash',
      instructions: settings.cash_instructions || undefined,
    });
  }

  if (settings.accept_zelle) {
    methods.push({
      id: 'zelle',
      label: 'Zelle',
      icon: Wallet,
      description: settings.zelle_username || settings.zelle_phone
        ? `Send to ${settings.zelle_username || settings.zelle_phone}`
        : 'Send via Zelle',
      category: 'traditional',
      apiValue: 'other',
      username: settings.zelle_username || settings.zelle_phone || undefined,
      instructions: settings.zelle_instructions || undefined,
    });
  }

  if (settings.accept_cashapp) {
    methods.push({
      id: 'cashapp',
      label: 'CashApp',
      icon: Wallet,
      description: settings.cashapp_username
        ? `Send to ${settings.cashapp_username}`
        : 'Send via CashApp',
      category: 'traditional',
      apiValue: 'other',
      username: settings.cashapp_username || undefined,
      instructions: settings.cashapp_instructions || undefined,
    });
  }

  // Crypto payments
  if (settings.accept_bitcoin && settings.bitcoin_address) {
    methods.push({
      id: 'bitcoin',
      label: 'Bitcoin',
      icon: Bitcoin,
      description: 'Pay with BTC',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.bitcoin_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  if (settings.accept_lightning && settings.lightning_address) {
    methods.push({
      id: 'lightning',
      label: 'Lightning',
      icon: Zap,
      description: 'Instant BTC via Lightning',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.lightning_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  if (settings.accept_ethereum && settings.ethereum_address) {
    methods.push({
      id: 'ethereum',
      label: 'Ethereum',
      icon: Coins,
      description: 'Pay with ETH',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.ethereum_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  if (settings.accept_usdt && settings.usdt_address) {
    methods.push({
      id: 'usdt',
      label: 'USDT',
      icon: Coins,
      description: 'Pay with Tether',
      category: 'crypto',
      apiValue: 'crypto',
      address: settings.usdt_address,
      instructions: settings.crypto_instructions || undefined,
    });
  }

  // If no methods enabled, default to cash
  if (methods.length === 0) {
    return DEFAULT_PAYMENT_METHODS;
  }

  return methods;
}

// Format phone number as user types
export const formatPhoneNumber = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
};

// Validate email
export const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
