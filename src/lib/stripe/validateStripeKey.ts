/**
 * Stripe key prefix validation.
 *
 * Ensures that only secret keys (sk_test_* / sk_live_*) are used
 * server-side — never publishable keys (pk_*) or restricted keys (rk_*).
 */

export interface StripeKeyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a Stripe key is a secret key with the correct prefix.
 *
 * Valid prefixes: sk_test_, sk_live_
 * Invalid: empty string, pk_*, rk_*, or any other prefix.
 */
export function validateStripeSecretKey(key: string | undefined | null): StripeKeyValidationResult {
  if (!key || key.trim() === '') {
    return {
      valid: false,
      error: 'STRIPE_SECRET_KEY is missing or empty.',
    };
  }

  if (key.startsWith('pk_')) {
    return {
      valid: false,
      error: "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a publishable key.",
    };
  }

  if (key.startsWith('rk_')) {
    return {
      valid: false,
      error: "Invalid Stripe configuration. Please use a secret key (starts with 'sk_'), not a restricted key.",
    };
  }

  if (!key.startsWith('sk_')) {
    return {
      valid: false,
      error: "Invalid Stripe configuration. The key must start with 'sk_'.",
    };
  }

  return { valid: true };
}
