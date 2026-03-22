/**
 * API Credit Metering Integration Tests
 *
 * Verifies that the unified API router (supabase/functions/api/index.ts)
 * correctly integrates withApiCreditMeter middleware from apiCreditMeter.ts.
 *
 * Also validates the API credit cost configuration is complete and consistent.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FUNCTIONS_DIR = path.resolve(__dirname, '../../../../supabase/functions');

function readSource(relativePath: string): string {
  const filePath = path.join(FUNCTIONS_DIR, relativePath);
  return fs.readFileSync(filePath, 'utf-8');
}

describe('API Credit Metering Integration', () => {
  const apiIndexSource = readSource('api/index.ts');

  describe('api/index.ts imports withApiCreditMeter', () => {
    it('should import withApiCreditMeter from _shared/apiCreditMeter', () => {
      expect(apiIndexSource).toContain(
        "import { withApiCreditMeter } from '../_shared/apiCreditMeter.ts'"
      );
    });

    it('should not import unused createClient', () => {
      // createClient should not appear as a standalone import since
      // withApiCreditMeter creates its own client internally
      const importLine = apiIndexSource
        .split('\n')
        .find((line) => line.includes("from '../_shared/deps.ts'"));
      expect(importLine).toBeDefined();
      expect(importLine).not.toContain('createClient');
    });
  });

  describe('api/index.ts wraps routing with credit metering', () => {
    it('should call withApiCreditMeter in the serve handler', () => {
      expect(apiIndexSource).toContain('withApiCreditMeter(req,');
    });

    it('should await the withApiCreditMeter call', () => {
      expect(apiIndexSource).toContain('await withApiCreditMeter(');
    });

    it('should return the result of withApiCreditMeter', () => {
      expect(apiIndexSource).toContain('return await withApiCreditMeter(');
    });
  });

  describe('rate limiting runs before credit metering', () => {
    it('should check rate limit before withApiCreditMeter call', () => {
      const rateLimitIndex = apiIndexSource.indexOf('checkRateLimit(');
      const creditMeterIndex = apiIndexSource.indexOf('withApiCreditMeter(');

      expect(rateLimitIndex).toBeGreaterThan(-1);
      expect(creditMeterIndex).toBeGreaterThan(-1);
      expect(rateLimitIndex).toBeLessThan(creditMeterIndex);
    });

    it('should return 429 before credit metering on rate limit', () => {
      // The 429 response should appear between the rate limit check and withApiCreditMeter
      const serveStart = apiIndexSource.indexOf('serve(async');
      const creditMeterStart = apiIndexSource.indexOf('withApiCreditMeter(');
      const sectionBeforeCreditMeter = apiIndexSource.slice(serveStart, creditMeterStart);

      expect(sectionBeforeCreditMeter).toContain('429');
      expect(sectionBeforeCreditMeter).toContain('RATE_LIMITED');
    });
  });

  describe('dead code cleanup', () => {
    it('should not contain unused extractUser function', () => {
      expect(apiIndexSource).not.toContain('async function extractUser');
    });

    it('should not reference SUPABASE_ANON_KEY in api/index.ts', () => {
      // The old extractUser used ANON_KEY; withApiCreditMeter uses SERVICE_ROLE_KEY
      expect(apiIndexSource).not.toContain('SUPABASE_ANON_KEY');
    });
  });

  describe('CORS handling is preserved', () => {
    it('should handle OPTIONS preflight before credit metering', () => {
      const optionsIndex = apiIndexSource.indexOf("req.method === 'OPTIONS'");
      const creditMeterIndex = apiIndexSource.indexOf('withApiCreditMeter(');

      expect(optionsIndex).toBeGreaterThan(-1);
      expect(creditMeterIndex).toBeGreaterThan(-1);
      expect(optionsIndex).toBeLessThan(creditMeterIndex);
    });
  });
});

describe('API Credit Cost Configuration', () => {
  const apiCreditMeterSource = readSource('_shared/apiCreditMeter.ts');

  describe('API_CREDIT_COSTS completeness', () => {
    it('should define costs for GET operations', () => {
      expect(apiCreditMeterSource).toContain("'GET /orders': 1");
      expect(apiCreditMeterSource).toContain("'GET /products': 1");
      expect(apiCreditMeterSource).toContain("'GET /customers': 1");
      expect(apiCreditMeterSource).toContain("'GET /inventory': 1");
      expect(apiCreditMeterSource).toContain("'GET /menus': 1");
    });

    it('should define costs for POST (create) operations', () => {
      expect(apiCreditMeterSource).toContain("'POST /orders': 25");
      expect(apiCreditMeterSource).toContain("'POST /products': 10");
      expect(apiCreditMeterSource).toContain("'POST /customers': 5");
      expect(apiCreditMeterSource).toContain("'POST /menus': 100");
    });

    it('should define costs for bulk operations', () => {
      expect(apiCreditMeterSource).toContain("'POST /orders/bulk': 100");
      expect(apiCreditMeterSource).toContain("'POST /products/bulk': 50");
      expect(apiCreditMeterSource).toContain("'POST /customers/bulk': 50");
    });

    it('should define costs for update operations', () => {
      expect(apiCreditMeterSource).toContain("'PUT /orders/:id': 10");
      expect(apiCreditMeterSource).toContain("'PATCH /orders/:id': 5");
      expect(apiCreditMeterSource).toContain("'PUT /products/:id': 5");
      expect(apiCreditMeterSource).toContain("'PATCH /products/:id': 3");
    });

    it('should define costs for delete operations', () => {
      expect(apiCreditMeterSource).toContain("'DELETE /orders/:id': 1");
      expect(apiCreditMeterSource).toContain("'DELETE /products/:id': 1");
      expect(apiCreditMeterSource).toContain("'DELETE /customers/:id': 1");
    });

    it('should define costs for communication endpoints', () => {
      expect(apiCreditMeterSource).toContain("'POST /sms/send': 25");
      expect(apiCreditMeterSource).toContain("'POST /email/send': 10");
      expect(apiCreditMeterSource).toContain("'POST /notifications/send': 15");
    });

    it('should define wildcard fallback costs for each HTTP method', () => {
      expect(apiCreditMeterSource).toContain("'GET *': 1");
      expect(apiCreditMeterSource).toContain("'POST *': 10");
      expect(apiCreditMeterSource).toContain("'PUT *': 5");
      expect(apiCreditMeterSource).toContain("'PATCH *': 3");
      expect(apiCreditMeterSource).toContain("'DELETE *': 1");
    });
  });

  describe('withApiCreditMeter middleware behavior', () => {
    it('should handle CORS preflight', () => {
      expect(apiCreditMeterSource).toContain("req.method === 'OPTIONS'");
    });

    it('should return 401 for missing/invalid API key', () => {
      expect(apiCreditMeterSource).toContain('status: 401');
      expect(apiCreditMeterSource).toContain('Invalid or missing API key');
    });

    it('should return 402 for insufficient credits', () => {
      expect(apiCreditMeterSource).toContain('status: 402');
      expect(apiCreditMeterSource).toContain('Insufficient credits');
      expect(apiCreditMeterSource).toContain('INSUFFICIENT_CREDITS');
    });

    it('should add credit headers to successful responses', () => {
      expect(apiCreditMeterSource).toContain("'X-Credits-Consumed'");
      expect(apiCreditMeterSource).toContain("'X-Credits-Remaining'");
    });

    it('should skip credit check for paid tiers by default', () => {
      expect(apiCreditMeterSource).toContain(
        'skipForPaid && !tenantInfo.isFreeTier'
      );
    });

    it('should log API usage for both success and failure', () => {
      expect(apiCreditMeterSource).toContain('logApiUsage(');
    });

    it('should use consume_credits RPC for credit deduction', () => {
      expect(apiCreditMeterSource).toContain("rpc('consume_credits'");
    });

    it('should use maybeSingle() for optional data lookups', () => {
      expect(apiCreditMeterSource).toContain('.maybeSingle()');
    });
  });

  describe('API credit cost logic', () => {
    it('should normalize endpoint paths by replacing UUIDs with :id', () => {
      expect(apiCreditMeterSource).toContain(
        "replace(/\\/[a-f0-9-]{36}/g, '/:id')"
      );
    });

    it('should strip API version prefix from paths', () => {
      expect(apiCreditMeterSource).toContain(
        "replace(/^\\/api\\/v\\d+/, '')"
      );
    });

    it('should try exact match before wildcard fallback', () => {
      // The getApiCreditCost function should check exact match first
      const getCostFn = apiCreditMeterSource.slice(
        apiCreditMeterSource.indexOf('function getApiCreditCost'),
        apiCreditMeterSource.indexOf('function consumeApiCredits')
      );

      const exactMatchIndex = getCostFn.indexOf('API_CREDIT_COSTS[endpointKey]');
      const wildcardMatchIndex = getCostFn.indexOf('wildcardKey');

      expect(exactMatchIndex).toBeGreaterThan(-1);
      expect(wildcardMatchIndex).toBeGreaterThan(-1);
      expect(exactMatchIndex).toBeLessThan(wildcardMatchIndex);
    });
  });
});
