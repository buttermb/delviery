/**
 * Edge Function Credit Gate Test Helpers
 *
 * Provides mock utilities for testing edge functions that use withCreditGate.
 * Tracks consumed action keys and offers assertion helpers.
 *
 * Usage:
 * ```typescript
 * import { mockCreditGate } from '../_shared/test-helpers/creditGate';
 *
 * describe('my-edge-function', () => {
 *   it('should consume credits on create', () => {
 *     const gate = mockCreditGate({ balance: 500, cost: 100 });
 *     // ... invoke your handler logic ...
 *     gate.expectCreditConsumed('create_order');
 *   });
 * });
 * ```
 */

import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface ConsumeCreditsRow {
  success: boolean;
  new_balance: number;
  credits_cost: number;
  error_message: string | null;
}

interface CreditGateConfig {
  /** Current credit balance for the tenant. Default: 10000 */
  balance?: number;
  /** Cost of the action being tested. Default: 100 */
  cost?: number;
  /** Whether the tenant is on the free tier. Default: true */
  isFreeTier?: boolean;
  /** Subscription status. Default: null */
  subscriptionStatus?: string | null;
  /** Override consume_credits RPC to always fail. Default: false */
  forceInsufficientCredits?: boolean;
  /** Override consume_credits RPC with a custom error. Default: null */
  rpcError?: { message: string; code?: string } | null;
  /** Tenant ID to use. Default: a deterministic UUID */
  tenantId?: string;
  /** User ID to use. Default: a deterministic UUID */
  userId?: string;
}

interface ConsumedAction {
  actionKey: string;
  tenantId: string;
  referenceId: string | null;
  referenceType: string | null;
  description: string | null;
}

interface TrackedAnalyticsEvent {
  tenantId: string;
  eventType: string;
  creditsAtEvent: number;
  actionAttempted: string | undefined;
}

interface MockCreditGateResult {
  /** The mock Supabase client to inject */
  supabaseClient: MockSupabaseClient;
  /** All actions that had credits consumed */
  consumedActions: ConsumedAction[];
  /** All analytics events tracked */
  analyticsEvents: TrackedAnalyticsEvent[];
  /** Assert a specific action key was consumed */
  expectCreditConsumed: (actionKey: string) => void;
  /** Assert a specific action key was NOT consumed */
  expectCreditNotConsumed: (actionKey: string) => void;
  /** Assert that credit consumption was blocked (402 response) */
  expectCreditBlocked: (actionKey: string) => void;
  /** Assert an analytics event was tracked */
  expectAnalyticsEvent: (eventType: string, actionKey?: string) => void;
  /** Get the total number of consumed actions */
  getConsumedCount: () => number;
  /** Reset all tracked state */
  reset: () => void;
  /** Tenant ID used by the mock */
  tenantId: string;
  /** User ID used by the mock */
  userId: string;
}

// ============================================================================
// Mock Supabase Client Types
// ============================================================================

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
}

interface MockSupabaseClient {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const DEFAULT_USER_ID = '00000000-0000-4000-a000-000000000002';

// ============================================================================
// Mock Credit Gate Factory
// ============================================================================

export function mockCreditGate(config: CreditGateConfig = {}): MockCreditGateResult {
  const {
    balance = 10000,
    cost = 100,
    isFreeTier = true,
    subscriptionStatus = null,
    forceInsufficientCredits = false,
    rpcError = null,
    tenantId = DEFAULT_TENANT_ID,
    userId = DEFAULT_USER_ID,
  } = config;

  const consumedActions: ConsumedAction[] = [];
  const analyticsEvents: TrackedAnalyticsEvent[] = [];
  let currentBalance = balance;

  // Build the mock Supabase client
  const supabaseClient = createMockSupabaseClient({
    tenantId,
    userId,
    isFreeTier,
    subscriptionStatus,
    currentBalance: () => currentBalance,
    cost,
    forceInsufficientCredits,
    rpcError,
    onConsumeCredits: (action: ConsumedAction, newBalance: number) => {
      consumedActions.push(action);
      currentBalance = newBalance;
    },
    onAnalyticsInsert: (event: TrackedAnalyticsEvent) => {
      analyticsEvents.push(event);
    },
  });

  return {
    supabaseClient,
    consumedActions,
    analyticsEvents,
    tenantId,
    userId,

    expectCreditConsumed(actionKey: string) {
      const found = consumedActions.some((a) => a.actionKey === actionKey);
      if (!found) {
        const consumed = consumedActions.map((a) => a.actionKey).join(', ') || '(none)';
        throw new Error(
          `Expected credit consumed for "${actionKey}" but it was not found. Consumed: ${consumed}`
        );
      }
    },

    expectCreditNotConsumed(actionKey: string) {
      const found = consumedActions.some((a) => a.actionKey === actionKey);
      if (found) {
        throw new Error(
          `Expected credit NOT consumed for "${actionKey}" but it was consumed`
        );
      }
    },

    expectCreditBlocked(actionKey: string) {
      const found = analyticsEvents.some(
        (e) =>
          e.eventType === 'action_blocked_insufficient_credits' &&
          e.actionAttempted === actionKey
      );
      if (!found) {
        const events = analyticsEvents.map((e) => `${e.eventType}:${e.actionAttempted}`).join(', ') || '(none)';
        throw new Error(
          `Expected credit blocked for "${actionKey}" but no blocking event found. Events: ${events}`
        );
      }
    },

    expectAnalyticsEvent(eventType: string, actionKey?: string) {
      const found = analyticsEvents.some(
        (e) =>
          e.eventType === eventType &&
          (actionKey === undefined || e.actionAttempted === actionKey)
      );
      if (!found) {
        const events = analyticsEvents.map((e) => `${e.eventType}:${e.actionAttempted}`).join(', ') || '(none)';
        throw new Error(
          `Expected analytics event "${eventType}"${actionKey ? ` for "${actionKey}"` : ''} but not found. Events: ${events}`
        );
      }
    },

    getConsumedCount() {
      return consumedActions.length;
    },

    reset() {
      consumedActions.length = 0;
      analyticsEvents.length = 0;
      currentBalance = balance;
    },
  };
}

// ============================================================================
// Mock Supabase Client Builder
// ============================================================================

interface MockClientConfig {
  tenantId: string;
  userId: string;
  isFreeTier: boolean;
  subscriptionStatus: string | null;
  currentBalance: () => number;
  cost: number;
  forceInsufficientCredits: boolean;
  rpcError: { message: string; code?: string } | null;
  onConsumeCredits: (action: ConsumedAction, newBalance: number) => void;
  onAnalyticsInsert: (event: TrackedAnalyticsEvent) => void;
}

function createMockSupabaseClient(config: MockClientConfig): MockSupabaseClient {
  const {
    tenantId,
    userId,
    isFreeTier,
    subscriptionStatus,
    currentBalance,
    cost,
    forceInsufficientCredits,
    rpcError,
    onConsumeCredits,
    onAnalyticsInsert,
  } = config;

  // Build chainable query builders for different tables
  function buildQueryBuilder(table: string): MockQueryBuilder {
    const builder: MockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      insert: vi.fn(),
    };

    // Configure responses based on table
    switch (table) {
      case 'tenant_users':
        builder.maybeSingle.mockResolvedValue({
          data: { tenant_id: tenantId },
          error: null,
        });
        break;

      case 'tenants':
        builder.maybeSingle.mockResolvedValue({
          data: {
            id: tenantId,
            is_free_tier: isFreeTier,
            subscription_status: subscriptionStatus,
          },
          error: null,
        });
        break;

      case 'credit_costs':
        builder.maybeSingle.mockResolvedValue({
          data: { credits: cost },
          error: null,
        });
        break;

      case 'tenant_credits':
        builder.maybeSingle.mockImplementation(() =>
          Promise.resolve({
            data: { balance: currentBalance() },
            error: null,
          })
        );
        break;

      case 'credit_analytics':
        builder.insert.mockImplementation((row: Record<string, unknown>) => {
          onAnalyticsInsert({
            tenantId: row.tenant_id as string,
            eventType: row.event_type as string,
            creditsAtEvent: row.credits_at_event as number,
            actionAttempted: row.action_attempted as string | undefined,
          });
          return Promise.resolve({ data: null, error: null });
        });
        break;

      default:
        builder.maybeSingle.mockResolvedValue({ data: null, error: null });
        builder.insert.mockResolvedValue({ data: null, error: null });
        break;
    }

    return builder;
  }

  // Mock rpc for consume_credits
  const rpcMock = vi.fn().mockImplementation((fnName: string, params: Record<string, unknown>) => {
    if (fnName === 'consume_credits') {
      if (rpcError) {
        return Promise.resolve({
          data: null,
          error: { message: rpcError.message, code: rpcError.code ?? 'UNKNOWN' },
        });
      }

      const actionKey = params.p_action_key as string;
      const bal = currentBalance();

      if (forceInsufficientCredits || bal < cost) {
        return Promise.resolve({
          data: [
            {
              success: false,
              new_balance: bal,
              credits_cost: cost,
              error_message: 'Insufficient credits',
            } satisfies ConsumeCreditsRow,
          ],
          error: null,
        });
      }

      const newBalance = bal - cost;
      onConsumeCredits(
        {
          actionKey,
          tenantId: params.p_tenant_id as string,
          referenceId: (params.p_reference_id as string) ?? null,
          referenceType: (params.p_reference_type as string) ?? null,
          description: (params.p_description as string) ?? null,
        },
        newBalance
      );

      return Promise.resolve({
        data: [
          {
            success: true,
            new_balance: newBalance,
            credits_cost: cost,
            error_message: null,
          } satisfies ConsumeCreditsRow,
        ],
        error: null,
      });
    }

    // Unknown RPC — return empty
    return Promise.resolve({ data: null, error: null });
  });

  // Track which tables have been queried
  const fromMock = vi.fn().mockImplementation((table: string) => buildQueryBuilder(table));

  // Mock auth
  const authMock = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: userId, email: 'test@example.com' } },
      error: null,
    }),
  };

  return {
    auth: authMock,
    from: fromMock,
    rpc: rpcMock,
  };
}

// ============================================================================
// Convenience Factories
// ============================================================================

/** Create a mock where credits are sufficient */
export function mockCreditGateSuccess(
  actionCost = 100,
  balance = 10000
): MockCreditGateResult {
  return mockCreditGate({ balance, cost: actionCost });
}

/** Create a mock where credits are insufficient */
export function mockCreditGateInsufficient(
  actionCost = 100,
  balance = 0
): MockCreditGateResult {
  return mockCreditGate({
    balance,
    cost: actionCost,
    forceInsufficientCredits: true,
  });
}

/** Create a mock for a paid-tier tenant (credits skipped) */
export function mockCreditGatePaidTier(): MockCreditGateResult {
  return mockCreditGate({ isFreeTier: false });
}

// ============================================================================
// Response Validation Helpers
// ============================================================================

/** Validate that a Response has the 402 insufficient credits format */
export async function expectInsufficientCreditsResponse(
  response: Response,
  expectedActionKey?: string
): Promise<void> {
  if (response.status !== 402) {
    throw new Error(`Expected status 402, got ${response.status}`);
  }

  const body = await response.json();

  if (body.code !== 'INSUFFICIENT_CREDITS') {
    throw new Error(
      `Expected error code "INSUFFICIENT_CREDITS", got "${body.code}"`
    );
  }

  if (typeof body.creditsRequired !== 'number') {
    throw new Error('Response missing creditsRequired field');
  }

  if (typeof body.currentBalance !== 'number') {
    throw new Error('Response missing currentBalance field');
  }

  if (expectedActionKey && body.actionKey !== expectedActionKey) {
    throw new Error(
      `Expected actionKey "${expectedActionKey}", got "${body.actionKey}"`
    );
  }
}

/** Validate that a successful response includes credit headers */
export function expectCreditHeaders(
  response: Response,
  expectedConsumed?: number,
  expectedRemaining?: number
): void {
  const consumed = response.headers.get('X-Credits-Consumed');
  const remaining = response.headers.get('X-Credits-Remaining');

  if (consumed === null) {
    throw new Error('Missing X-Credits-Consumed header');
  }

  if (remaining === null) {
    throw new Error('Missing X-Credits-Remaining header');
  }

  if (expectedConsumed !== undefined && Number(consumed) !== expectedConsumed) {
    throw new Error(
      `Expected X-Credits-Consumed=${expectedConsumed}, got ${consumed}`
    );
  }

  if (expectedRemaining !== undefined && Number(remaining) !== expectedRemaining) {
    throw new Error(
      `Expected X-Credits-Remaining=${expectedRemaining}, got ${remaining}`
    );
  }
}

// ============================================================================
// Request Builder Helper
// ============================================================================

/** Build a mock Request with Authorization header for testing edge functions */
export function buildCreditGateRequest(
  body: Record<string, unknown> = {},
  options: {
    method?: string;
    authToken?: string;
    headers?: Record<string, string>;
  } = {}
): Request {
  const { method = 'POST', authToken = 'test-jwt-token', headers = {} } = options;

  return new Request('https://test.supabase.co/functions/v1/test-fn', {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...headers,
    },
    body: method !== 'GET' ? JSON.stringify(body) : undefined,
  });
}
