/**
 * Shared types and context for Stripe webhook event handlers.
 */
import type { SupabaseClient } from '../../_shared/deps.ts';
import { Stripe } from '../../_shared/stripe.ts';
import type { StripeWebhookInput } from '../validation.ts';

/** Context passed to every event handler */
export interface HandlerContext {
  readonly supabase: SupabaseClient;
  readonly stripe: InstanceType<typeof Stripe>;
  readonly event: StripeWebhookInput;
  readonly stripeEventId: string;
}

/** Return type for handlers that need to send an early HTTP response */
export interface HandlerError {
  readonly message: string;
  readonly status: number;
}

/** Result from a handler: either success (void) or an error response */
export type HandlerResult = void | HandlerError;

/** Helper to create a handler error */
export function handlerError(message: string, status: number): HandlerError {
  return { message, status };
}

/** Type guard to check if a handler returned an error */
export function isHandlerError(result: HandlerResult): result is HandlerError {
  return result !== undefined && result !== null && typeof result === 'object' && 'message' in result;
}
