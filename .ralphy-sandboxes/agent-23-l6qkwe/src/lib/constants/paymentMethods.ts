/**
 * Centralized payment method constants
 *
 * Used across POS, invoice, and order payment dropdowns
 * to ensure consistent values and labels.
 */

export interface PaymentMethodOption {
  value: string;
  label: string;
}

/** Payment methods for POS / in-person transactions */
export const POS_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'debit', label: 'Debit Card' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
] as const;

/** Payment methods for invoice / wholesale / business payments */
export const INVOICE_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'other', label: 'Other' },
] as const;

/** Payment methods for order payment recording */
export const ORDER_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
] as const;

/** Map of all known payment method values to human-readable labels */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  credit: 'Credit Card',
  debit: 'Debit Card',
  check: 'Check',
  bank_transfer: 'Bank Transfer',
  wire_transfer: 'Wire Transfer',
  venmo: 'Venmo',
  zelle: 'Zelle',
  ach: 'ACH',
  crypto: 'Crypto',
  invoice: 'Invoice',
  original_method: 'Original Payment Method',
  other: 'Other',
};

/** Format a payment method value to a human-readable label */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return 'Unknown';
  const normalized = method.toLowerCase().trim();
  return PAYMENT_METHOD_LABELS[normalized] || method.charAt(0).toUpperCase() + method.slice(1);
}
