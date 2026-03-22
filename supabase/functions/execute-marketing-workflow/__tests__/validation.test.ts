/**
 * Tests for execute-marketing-workflow validation schema.
 *
 * Verifies that the Zod schema correctly validates inputs including
 * the dryRun flag used for credit cost estimation.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-define the schema here since the source uses Deno imports
// This mirrors supabase/functions/execute-marketing-workflow/validation.ts
const executeMarketingWorkflowSchema = z.object({
  workflowId: z.string().uuid('Invalid workflow ID format'),
  triggerData: z.record(z.unknown()).optional().default({}),
  dryRun: z.boolean().optional().default(false),
});

describe('executeMarketingWorkflowSchema', () => {
  it('accepts valid input with all fields', () => {
    const input = {
      workflowId: '550e8400-e29b-41d4-a716-446655440000',
      triggerData: { event: 'order_placed' },
      dryRun: true,
    };
    const result = executeMarketingWorkflowSchema.parse(input);

    expect(result.workflowId).toBe(input.workflowId);
    expect(result.triggerData).toEqual(input.triggerData);
    expect(result.dryRun).toBe(true);
  });

  it('defaults dryRun to false when omitted', () => {
    const input = {
      workflowId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = executeMarketingWorkflowSchema.parse(input);

    expect(result.dryRun).toBe(false);
  });

  it('defaults triggerData to empty object when omitted', () => {
    const input = {
      workflowId: '550e8400-e29b-41d4-a716-446655440000',
    };
    const result = executeMarketingWorkflowSchema.parse(input);

    expect(result.triggerData).toEqual({});
  });

  it('rejects invalid workflowId format', () => {
    const input = {
      workflowId: 'not-a-uuid',
    };

    expect(() => executeMarketingWorkflowSchema.parse(input)).toThrow();
  });

  it('rejects missing workflowId', () => {
    const input = {};

    expect(() => executeMarketingWorkflowSchema.parse(input)).toThrow();
  });

  it('rejects non-boolean dryRun', () => {
    const input = {
      workflowId: '550e8400-e29b-41d4-a716-446655440000',
      dryRun: 'yes',
    };

    expect(() => executeMarketingWorkflowSchema.parse(input)).toThrow();
  });
});

describe('credit deduction response contract', () => {
  // These schemas define the expected response shapes from the edge function

  const insufficientCreditsResponseSchema = z.object({
    error: z.literal('Insufficient credits'),
    code: z.literal('INSUFFICIENT_CREDITS'),
    message: z.string(),
    creditsRequired: z.number().int().nonnegative(),
    currentBalance: z.number().int().nonnegative(),
    costBreakdown: z.array(z.object({
      action: z.string(),
      cost: z.number().int().nonnegative(),
    })),
  });

  const dryRunResponseSchema = z.object({
    success: z.literal(true),
    dryRun: z.literal(true),
    creditCost: z.number().int().nonnegative(),
    costBreakdown: z.array(z.object({
      action: z.string(),
      cost: z.number().int().nonnegative(),
    })),
    workflowName: z.string(),
    actionsCount: z.number().int().nonnegative(),
  });

  const successResponseSchema = z.object({
    success: z.literal(true),
    workflowName: z.string(),
    actionsExecuted: z.number().int().nonnegative(),
    results: z.array(z.object({
      action: z.string(),
      status: z.string(),
    })),
    creditsConsumed: z.number().int().nonnegative().optional(),
    creditsRemaining: z.number().int().optional(),
    costBreakdown: z.array(z.object({
      action: z.string(),
      cost: z.number().int().nonnegative(),
    })).optional(),
  });

  it('validates the 402 insufficient credits response shape', () => {
    const sample = {
      error: 'Insufficient credits',
      code: 'INSUFFICIENT_CREDITS',
      message: 'Not enough credits to execute this workflow',
      creditsRequired: 43,
      currentBalance: 10,
      costBreakdown: [
        { action: 'send_email', cost: 8 },
        { action: 'send_sms', cost: 20 },
        { action: 'award_points', cost: 15 },
      ],
    };
    expect(() => insufficientCreditsResponseSchema.parse(sample)).not.toThrow();
  });

  it('validates the dry run response shape', () => {
    const sample = {
      success: true,
      dryRun: true,
      creditCost: 43,
      costBreakdown: [
        { action: 'send_email', cost: 8 },
        { action: 'send_sms', cost: 20 },
        { action: 'award_points', cost: 15 },
      ],
      workflowName: 'Welcome Campaign',
      actionsCount: 3,
    };
    expect(() => dryRunResponseSchema.parse(sample)).not.toThrow();
  });

  it('validates the success response shape with credit info', () => {
    const sample = {
      success: true,
      workflowName: 'Welcome Campaign',
      actionsExecuted: 3,
      results: [
        { action: 'send_email', status: 'success' },
        { action: 'send_sms', status: 'success' },
        { action: 'award_points', status: 'success' },
      ],
      creditsConsumed: 43,
      creditsRemaining: 957,
      costBreakdown: [
        { action: 'send_email', cost: 8 },
        { action: 'send_sms', cost: 20 },
        { action: 'award_points', cost: 15 },
      ],
    };
    expect(() => successResponseSchema.parse(sample)).not.toThrow();
  });

  it('validates the success response shape without credit info (paid tier)', () => {
    const sample = {
      success: true,
      workflowName: 'Welcome Campaign',
      actionsExecuted: 3,
      results: [
        { action: 'send_email', status: 'success' },
        { action: 'send_sms', status: 'success' },
        { action: 'award_points', status: 'success' },
      ],
    };
    expect(() => successResponseSchema.parse(sample)).not.toThrow();
  });
});
