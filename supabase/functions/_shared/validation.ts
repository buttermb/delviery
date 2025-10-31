/**
 * Server-side input validation and sanitization utilities
 * CRITICAL: Always validate inputs before processing
 */

export function sanitizeString(input: string, maxLength: number = 255): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

export function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function validatePhoneNumber(phone: string): boolean {
  // US phone number validation
  const phoneRegex = /^\+?1?\d{10}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

export function validateBorough(borough: string): boolean {
  const validBoroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
  return validBoroughs.includes(borough);
}

export function validateOrderItems(items: any[]): { valid: boolean; error?: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Items must be a non-empty array' };
  }

  if (items.length > 50) {
    return { valid: false, error: 'Too many items in order' };
  }

  for (const item of items) {
    if (!item.productId || !validateUUID(item.productId)) {
      return { valid: false, error: 'Invalid product ID' };
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      return { valid: false, error: 'Invalid quantity' };
    }
  }

  return { valid: true };
}

export function validatePaymentMethod(method: string): boolean {
  return ['cash', 'card', 'crypto'].includes(method);
}

export function sanitizeOrderInput(input: any): {
  items: any[];
  addressId: string;
  paymentMethod: string;
  deliveryNotes?: string;
} {
  return {
    items: input.items || [],
    addressId: sanitizeString(input.addressId, 36),
    paymentMethod: sanitizeString(input.paymentMethod, 20),
    deliveryNotes: input.deliveryNotes ? sanitizeString(input.deliveryNotes, 500) : undefined
  };
}

// Simple in-memory rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function validateRateLimit(identifier: string, limit: number, window: number): boolean {
  const now = Date.now();
  const key = `${identifier}:${Math.floor(now / window)}`;
  
  const current = rateLimitStore.get(key);
  
  if (!current) {
    rateLimitStore.set(key, { count: 1, resetAt: now + window });
    return true;
  }
  
  if (now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + window });
    return true;
  }
  
  if (current.count >= limit) {
    return false;
  }
  
  current.count++;
  return true;
}
