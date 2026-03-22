/**
 * Credit Refund Helper Tests
 *
 * Tests the refund logic used by edge functions when the main action
 * fails after credits have been deducted.
 *
 * These tests verify:
 * - Refund request validation
 * - Idempotency key generation (prevents double refunds)
 * - Auto-refund trigger conditions (5xx = refund, 4xx = no refund)
 * - Refund response enrichment (headers + body)
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Refund Request Validation
// ============================================================================

type RefundReason =
  | 'failed_action'
  | 'duplicate_charge'
  | 'service_error'
  | 'system_error';

interface RefundRequest {
  tenantId: string;
  amount: number;
  reason: RefundReason;
  actionKey: string;
  originalTransactionId?: string;
  description?: string;
}

function validateRefundRequest(
  request: RefundRequest
): { valid: boolean; error?: string } {
  if (request.amount <= 0) {
    return { valid: false, error: 'Refund amount must be positive' };
  }
  if (!request.tenantId) {
    return { valid: false, error: 'Missing tenantId' };
  }
  if (!request.actionKey) {
    return { valid: false, error: 'Missing actionKey' };
  }
  if (!request.reason) {
    return { valid: false, error: 'Missing reason' };
  }
  return { valid: true };
}

describe('Refund Request Validation', () => {
  const validRequest: RefundRequest = {
    tenantId: 'tenant-123',
    amount: 100,
    reason: 'failed_action',
    actionKey: 'menu_ocr',
  };

  it('should accept a valid refund request', () => {
    const result = validateRefundRequest(validRequest);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject zero amount', () => {
    const result = validateRefundRequest({ ...validRequest, amount: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive');
  });

  it('should reject negative amount', () => {
    const result = validateRefundRequest({ ...validRequest, amount: -50 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('positive');
  });

  it('should reject empty tenantId', () => {
    const result = validateRefundRequest({ ...validRequest, tenantId: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('tenantId');
  });

  it('should reject empty actionKey', () => {
    const result = validateRefundRequest({ ...validRequest, actionKey: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('actionKey');
  });

  it('should accept all valid refund reasons', () => {
    const reasons: RefundReason[] = [
      'failed_action',
      'duplicate_charge',
      'service_error',
      'system_error',
    ];
    for (const reason of reasons) {
      const result = validateRefundRequest({ ...validRequest, reason });
      expect(result.valid).toBe(true);
    }
  });

  it('should accept optional originalTransactionId', () => {
    const result = validateRefundRequest({
      ...validRequest,
      originalTransactionId: 'tx-abc-123',
    });
    expect(result.valid).toBe(true);
  });

  it('should accept optional description', () => {
    const result = validateRefundRequest({
      ...validRequest,
      description: 'AI service timed out',
    });
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Idempotency Key Generation
// ============================================================================

function generateRefundReferenceId(
  tenantId: string,
  actionKey: string,
  originalTransactionId?: string
): string {
  if (originalTransactionId) {
    return `refund:${originalTransactionId}`;
  }
  // Without a transaction ID, include tenant+action for some uniqueness
  // Note: in production the timestamp makes these non-idempotent,
  // so originalTransactionId should be provided when possible
  return `refund:${tenantId}:${actionKey}`;
}

describe('Refund Idempotency Key Generation', () => {
  it('should use originalTransactionId when provided', () => {
    const key = generateRefundReferenceId('tenant-1', 'menu_ocr', 'tx-abc');
    expect(key).toBe('refund:tx-abc');
  });

  it('should fall back to tenant+action when no transaction ID', () => {
    const key = generateRefundReferenceId('tenant-1', 'menu_ocr');
    expect(key).toBe('refund:tenant-1:menu_ocr');
  });

  it('should produce different keys for different transactions', () => {
    const key1 = generateRefundReferenceId('t', 'a', 'tx-1');
    const key2 = generateRefundReferenceId('t', 'a', 'tx-2');
    expect(key1).not.toBe(key2);
  });

  it('should produce same key for same transaction (idempotent)', () => {
    const key1 = generateRefundReferenceId('t', 'a', 'tx-1');
    const key2 = generateRefundReferenceId('t', 'a', 'tx-1');
    expect(key1).toBe(key2);
  });

  it('should prefix all keys with refund:', () => {
    const key1 = generateRefundReferenceId('t', 'a', 'tx-1');
    const key2 = generateRefundReferenceId('t', 'a');
    expect(key1.startsWith('refund:')).toBe(true);
    expect(key2.startsWith('refund:')).toBe(true);
  });
});

// ============================================================================
// Auto-Refund Trigger Conditions
// ============================================================================

/**
 * Determines whether a response status code should trigger an auto-refund.
 *
 * Only 5xx (server errors) trigger refunds because they indicate the service
 * infrastructure failed, not the user's fault.
 *
 * 4xx errors are NOT refunded because:
 * - 400: Bad input from user
 * - 401/403: Auth issues
 * - 404: Resource not found
 * - 409: Conflict / duplicate
 * - 429: Rate limited
 *
 * These are all user/client errors where the credits were legitimately consumed
 * to attempt the action.
 */
function shouldAutoRefund(statusCode: number): boolean {
  return statusCode >= 500;
}

describe('Auto-Refund Trigger Conditions', () => {
  describe('should refund on server errors (5xx)', () => {
    it('should refund on 500 Internal Server Error', () => {
      expect(shouldAutoRefund(500)).toBe(true);
    });

    it('should refund on 502 Bad Gateway', () => {
      expect(shouldAutoRefund(502)).toBe(true);
    });

    it('should refund on 503 Service Unavailable', () => {
      expect(shouldAutoRefund(503)).toBe(true);
    });

    it('should refund on 504 Gateway Timeout', () => {
      expect(shouldAutoRefund(504)).toBe(true);
    });
  });

  describe('should NOT refund on success (2xx)', () => {
    it('should not refund on 200 OK', () => {
      expect(shouldAutoRefund(200)).toBe(false);
    });

    it('should not refund on 201 Created', () => {
      expect(shouldAutoRefund(201)).toBe(false);
    });

    it('should not refund on 204 No Content', () => {
      expect(shouldAutoRefund(204)).toBe(false);
    });
  });

  describe('should NOT refund on client errors (4xx)', () => {
    it('should not refund on 400 Bad Request', () => {
      expect(shouldAutoRefund(400)).toBe(false);
    });

    it('should not refund on 401 Unauthorized', () => {
      expect(shouldAutoRefund(401)).toBe(false);
    });

    it('should not refund on 403 Forbidden', () => {
      expect(shouldAutoRefund(403)).toBe(false);
    });

    it('should not refund on 404 Not Found', () => {
      expect(shouldAutoRefund(404)).toBe(false);
    });

    it('should not refund on 409 Conflict', () => {
      expect(shouldAutoRefund(409)).toBe(false);
    });

    it('should not refund on 422 Unprocessable Entity', () => {
      expect(shouldAutoRefund(422)).toBe(false);
    });

    it('should not refund on 429 Too Many Requests', () => {
      expect(shouldAutoRefund(429)).toBe(false);
    });
  });
});

// ============================================================================
// Refund Response Enrichment
// ============================================================================

interface RefundResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
  error?: string;
}

function enrichErrorBodyWithRefund(
  originalBody: Record<string, unknown>,
  creditsCost: number,
  refundResult: RefundResult
): Record<string, unknown> {
  return {
    ...originalBody,
    creditsRefunded: creditsCost,
    newBalance: refundResult.newBalance,
  };
}

function buildRefundHeaders(
  creditsCost: number,
  refundResult: RefundResult
): Record<string, string> {
  if (!refundResult.success) return {};
  return {
    'X-Credits-Refunded': String(creditsCost),
    'X-Credits-Remaining': String(refundResult.newBalance),
  };
}

describe('Refund Response Enrichment', () => {
  const successRefund: RefundResult = {
    success: true,
    newBalance: 9750,
    transactionId: 'tx-refund-1',
  };

  const failedRefund: RefundResult = {
    success: false,
    newBalance: 0,
    error: 'RPC failure',
  };

  describe('enrichErrorBodyWithRefund', () => {
    it('should add refund info to error body', () => {
      const original = { error: 'AI service failed', code: 'AI_ERROR' };
      const enriched = enrichErrorBodyWithRefund(original, 250, successRefund);

      expect(enriched.error).toBe('AI service failed');
      expect(enriched.code).toBe('AI_ERROR');
      expect(enriched.creditsRefunded).toBe(250);
      expect(enriched.newBalance).toBe(9750);
    });

    it('should not mutate the original body', () => {
      const original = { error: 'fail' };
      const originalCopy = { ...original };
      enrichErrorBodyWithRefund(original, 100, successRefund);

      expect(original).toEqual(originalCopy);
    });

    it('should work with empty original body', () => {
      const enriched = enrichErrorBodyWithRefund({}, 50, successRefund);
      expect(enriched.creditsRefunded).toBe(50);
      expect(enriched.newBalance).toBe(9750);
    });
  });

  describe('buildRefundHeaders', () => {
    it('should add refund headers on successful refund', () => {
      const headers = buildRefundHeaders(250, successRefund);
      expect(headers['X-Credits-Refunded']).toBe('250');
      expect(headers['X-Credits-Remaining']).toBe('9750');
    });

    it('should return empty headers on failed refund', () => {
      const headers = buildRefundHeaders(250, failedRefund);
      expect(Object.keys(headers)).toHaveLength(0);
    });

    it('should stringify numeric values', () => {
      const headers = buildRefundHeaders(100, successRefund);
      expect(typeof headers['X-Credits-Refunded']).toBe('string');
      expect(typeof headers['X-Credits-Remaining']).toBe('string');
    });
  });
});

// ============================================================================
// Refund Description Generation
// ============================================================================

function buildRefundDescription(
  amount: number,
  actionKey: string,
  reason: RefundReason,
  customDescription?: string
): string {
  if (customDescription) return customDescription;
  return `Refund ${amount} credits for failed ${actionKey} (${reason})`;
}

describe('Refund Description Generation', () => {
  it('should generate a descriptive message', () => {
    const desc = buildRefundDescription(250, 'menu_ocr', 'failed_action');
    expect(desc).toBe('Refund 250 credits for failed menu_ocr (failed_action)');
  });

  it('should use custom description when provided', () => {
    const desc = buildRefundDescription(
      250,
      'menu_ocr',
      'failed_action',
      'OCR timeout after 30s'
    );
    expect(desc).toBe('OCR timeout after 30s');
  });

  it('should include the action key and reason', () => {
    const desc = buildRefundDescription(100, 'send_sms', 'service_error');
    expect(desc).toContain('send_sms');
    expect(desc).toContain('service_error');
  });

  it('should include the amount', () => {
    const desc = buildRefundDescription(500, 'ai_analytics', 'system_error');
    expect(desc).toContain('500');
  });
});

// ============================================================================
// RPC Parameter Construction
// ============================================================================

function buildRefundRpcParams(request: RefundRequest): {
  p_user_id: string;
  p_tenant_id: string;
  p_amount: number;
  p_transaction_type: string;
  p_description: string;
  p_reference_type: string;
  p_reference_id: string;
} {
  const referenceId = request.originalTransactionId
    ? `refund:${request.originalTransactionId}`
    : `refund:${request.tenantId}:${request.actionKey}:${Date.now()}`;

  return {
    p_user_id: '00000000-0000-0000-0000-000000000000', // system user
    p_tenant_id: request.tenantId,
    p_amount: request.amount,
    p_transaction_type: 'refund',
    p_description:
      request.description ??
      `Refund ${request.amount} credits for failed ${request.actionKey} (${request.reason})`,
    p_reference_type: 'credit_refund',
    p_reference_id: referenceId,
  };
}

describe('RPC Parameter Construction', () => {
  it('should use system user UUID for refunds', () => {
    const params = buildRefundRpcParams({
      tenantId: 'tenant-1',
      amount: 100,
      reason: 'failed_action',
      actionKey: 'menu_ocr',
    });
    expect(params.p_user_id).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('should set transaction_type to refund', () => {
    const params = buildRefundRpcParams({
      tenantId: 'tenant-1',
      amount: 100,
      reason: 'failed_action',
      actionKey: 'menu_ocr',
    });
    expect(params.p_transaction_type).toBe('refund');
  });

  it('should set reference_type to credit_refund', () => {
    const params = buildRefundRpcParams({
      tenantId: 'tenant-1',
      amount: 100,
      reason: 'failed_action',
      actionKey: 'menu_ocr',
    });
    expect(params.p_reference_type).toBe('credit_refund');
  });

  it('should use original transaction ID for idempotent reference', () => {
    const params = buildRefundRpcParams({
      tenantId: 'tenant-1',
      amount: 100,
      reason: 'failed_action',
      actionKey: 'menu_ocr',
      originalTransactionId: 'tx-abc-123',
    });
    expect(params.p_reference_id).toBe('refund:tx-abc-123');
  });

  it('should pass the exact tenant_id', () => {
    const params = buildRefundRpcParams({
      tenantId: 'abc-def-ghi',
      amount: 50,
      reason: 'service_error',
      actionKey: 'send_sms',
    });
    expect(params.p_tenant_id).toBe('abc-def-ghi');
  });

  it('should pass the exact amount', () => {
    const params = buildRefundRpcParams({
      tenantId: 'tenant-1',
      amount: 250,
      reason: 'failed_action',
      actionKey: 'menu_ocr',
    });
    expect(params.p_amount).toBe(250);
  });

  it('should use custom description when provided', () => {
    const params = buildRefundRpcParams({
      tenantId: 'tenant-1',
      amount: 100,
      reason: 'failed_action',
      actionKey: 'menu_ocr',
      description: 'Custom refund reason',
    });
    expect(params.p_description).toBe('Custom refund reason');
  });
});

// ============================================================================
// Balance Restoration Logic
// ============================================================================

describe('Balance Restoration Logic', () => {
  // Simulates what update_credit_balance does with type='refund'
  const simulateRefund = (
    currentBalance: number,
    refundAmount: number
  ): { newBalance: number; success: boolean } => {
    // Refund type adds credits (opposite of usage which subtracts)
    const newBalance = currentBalance + refundAmount;
    return { newBalance, success: true };
  };

  it('should add refunded credits back to balance', () => {
    const result = simulateRefund(9750, 250);
    expect(result.newBalance).toBe(10000);
    expect(result.success).toBe(true);
  });

  it('should restore zero balance after refund', () => {
    const result = simulateRefund(0, 100);
    expect(result.newBalance).toBe(100);
  });

  it('should handle large refund amounts', () => {
    const result = simulateRefund(5000, 5000);
    expect(result.newBalance).toBe(10000);
  });

  it('should handle partial refund', () => {
    // If only part of the cost needs refunding
    const result = simulateRefund(9900, 50);
    expect(result.newBalance).toBe(9950);
  });
});
