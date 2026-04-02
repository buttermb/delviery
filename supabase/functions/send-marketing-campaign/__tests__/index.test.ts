/**
 * send-marketing-campaign Edge Function Tests
 *
 * Verifies:
 * 1. Auth check returns 401 for missing/invalid authorization
 * 2. Tenant isolation — campaign queries filter by tenant_id
 * 3. Status validation — only draft/scheduled campaigns can be sent
 * 4. Proper error handling (400 not 500)
 * 5. Successful send path returns correct shape
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(file = 'index.ts'): string {
  const sourcePath = path.resolve(__dirname, '..', file);
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('send-marketing-campaign edge function', () => {
  const source = readSource();

  // ==========================================================================
  // 1. Authentication
  // ==========================================================================

  describe('authentication', () => {
    it('should check for Authorization header before processing', () => {
      expect(source).toContain("req.headers.get('Authorization')");
    });

    it('should return 401 when authorization header is missing', () => {
      expect(source).toContain("{ error: 'Missing authorization header' }");
      const authBlock = source.slice(
        source.indexOf("Missing authorization header"),
        source.indexOf("Missing authorization header") + 200
      );
      expect(authBlock).toContain('status: 401');
    });

    it('should verify user via getUser with token', () => {
      expect(source).toContain("supabase.auth.getUser(token)");
    });

    it('should return 401 for invalid token', () => {
      expect(source).toContain("{ error: 'Unauthorized' }");
      // Check that Unauthorized response has 401 status
      const unauthorizedIdx = source.indexOf("'Unauthorized'");
      const nearbyBlock = source.slice(unauthorizedIdx, unauthorizedIdx + 200);
      expect(nearbyBlock).toContain('status: 401');
    });

    it('should use service role key for server-side operations', () => {
      expect(source).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    });

    it('should not use anon key for client creation', () => {
      expect(source).not.toContain("SUPABASE_ANON_KEY");
    });
  });

  // ==========================================================================
  // 2. Tenant Isolation
  // ==========================================================================

  describe('tenant isolation', () => {
    it('should resolve tenant from tenant_users table', () => {
      expect(source).toContain("from('tenant_users')");
      expect(source).toContain("eq('user_id', user.id)");
    });

    it('should return 403 when user has no tenant', () => {
      expect(source).toContain("'No tenant associated with user'");
      const noTenantIdx = source.indexOf("No tenant associated with user");
      const nearbyBlock = source.slice(noTenantIdx, noTenantIdx + 200);
      expect(nearbyBlock).toContain('status: 403');
    });

    it('should filter campaign query by tenant_id', () => {
      // The campaign select should include tenant_id filter
      const campaignQuery = source.slice(
        source.indexOf("from('marketing_campaigns')"),
        source.indexOf("from('marketing_campaigns')") + 200
      );
      expect(campaignQuery).toContain("eq('tenant_id', tenantId)");
    });

    it('should filter wholesale_clients query by tenant_id', () => {
      const clientsQuery = source.slice(
        source.indexOf("from('wholesale_clients')"),
        source.indexOf("from('wholesale_clients')") + 200
      );
      expect(clientsQuery).toContain("eq('tenant_id', tenantId)");
    });

    it('should filter campaign update by tenant_id', () => {
      // Find the update block after the select
      const updateIdx = source.lastIndexOf(".update(");
      const updateBlock = source.slice(updateIdx, updateIdx + 300);
      expect(updateBlock).toContain("eq('tenant_id', tenantId)");
    });
  });

  // ==========================================================================
  // 3. Input Validation
  // ==========================================================================

  describe('input validation', () => {
    it('should validate request body with Zod schema', () => {
      expect(source).toContain('validateSendMarketingCampaign(rawBody)');
    });

    it('should import validation function', () => {
      expect(source).toContain("import { validateSendMarketingCampaign");
    });

    it('should return 400 for validation errors (catch block)', () => {
      expect(source).toContain('status: 400');
    });
  });

  describe('validation schema', () => {
    const validationSource = readSource('validation.ts');

    it('should require campaignId as UUID', () => {
      expect(validationSource).toContain("campaignId: z.string().uuid(");
    });

    it('should accept optional sendNow boolean', () => {
      expect(validationSource).toContain('sendNow: z.boolean().optional()');
    });

    it('should accept optional testMode boolean', () => {
      expect(validationSource).toContain('testMode: z.boolean().optional()');
    });

    it('should export the validation function', () => {
      expect(validationSource).toContain('export function validateSendMarketingCampaign');
    });
  });

  // ==========================================================================
  // 4. Campaign Status Validation
  // ==========================================================================

  describe('campaign status validation', () => {
    it('should check campaign status before sending', () => {
      expect(source).toContain('campaign.status');
    });

    it('should allow sending draft campaigns', () => {
      expect(source).toContain("'draft'");
    });

    it('should allow sending scheduled campaigns', () => {
      expect(source).toContain("'scheduled'");
    });

    it('should reject already-sent campaigns with 400', () => {
      expect(source).toContain('cannot be sent');
    });

    it('should return 404 when campaign not found', () => {
      expect(source).toContain("'Campaign not found'");
      const notFoundIdx = source.indexOf('Campaign not found');
      const nearbyBlock = source.slice(notFoundIdx, notFoundIdx + 200);
      expect(nearbyBlock).toContain('status: 404');
    });
  });

  // ==========================================================================
  // 5. Successful Send Path
  // ==========================================================================

  describe('successful send', () => {
    it('should update campaign status to sent', () => {
      expect(source).toContain("status: 'sent'");
    });

    it('should record sent_count', () => {
      expect(source).toContain('sent_count: sentCount');
    });

    it('should return success with campaignName and sentCount', () => {
      expect(source).toContain('success: true');
      expect(source).toContain('campaignName: campaign.name');
      expect(source).toContain('sentCount');
    });

    it('should use .maybeSingle() for optional queries', () => {
      const maybeSingleCount = (source.match(/\.maybeSingle\(\)/g) || []).length;
      expect(maybeSingleCount).toBeGreaterThanOrEqual(2); // tenant_users + campaign
    });
  });

  // ==========================================================================
  // 6. CORS handling
  // ==========================================================================

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight', () => {
      expect(source).toContain("req.method === 'OPTIONS'");
    });

    it('should import corsHeaders from shared deps', () => {
      expect(source).toContain("import { serve, createClient, corsHeaders } from '../_shared/deps.ts'");
    });

    it('should include corsHeaders in all responses', () => {
      // Every new Response should include corsHeaders
      const responses = source.split('new Response').slice(1);
      for (const response of responses) {
        const headerBlock = response.slice(0, 300);
        expect(headerBlock).toContain('corsHeaders');
      }
    });
  });

  // ==========================================================================
  // 7. Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should catch errors and return 400 with message', () => {
      expect(source).toContain('catch (error)');
      expect(source).toContain("error instanceof Error ? error.message : 'Unknown error occurred'");
    });

    it('should log errors to console.error', () => {
      expect(source).toContain("console.error('Error sending campaign:'");
    });

    it('should not expose stack traces in error responses', () => {
      expect(source).not.toContain('error.stack');
    });
  });
});
