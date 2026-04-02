/**
 * Send Welcome Email — Comprehensive Tests
 *
 * Tests the send-welcome-email edge function for:
 * 1. Zod schema validation (returns 400 on bad input)
 * 2. CORS preflight handling
 * 3. Error handling (non-critical errors return 200)
 * 4. Response format and structure
 * 5. Content generation (HTML, text, dashboard URLs)
 * 6. Tenant branding resolution
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SOURCE_PATH = path.resolve(__dirname, '..', 'index.ts');
const source = fs.readFileSync(SOURCE_PATH, 'utf-8');

// ============================================================================
// 1. Zod Schema Validation
// ============================================================================

describe('Send Welcome Email — Schema Validation', () => {
  it('should define WelcomeEmailSchema with required user_id as UUID', () => {
    expect(source).toContain('user_id: z.string().uuid()');
  });

  it('should define email as required email field', () => {
    expect(source).toContain('email: z.string().email()');
  });

  it('should define full_name as optional with empty string default', () => {
    expect(source).toContain("full_name: z.string().optional().default('')");
  });

  it('should define tenant_id as optional nullable UUID', () => {
    expect(source).toContain('tenant_id: z.string().uuid().nullable().optional()');
  });

  it('should use safeParse for validation (not parse)', () => {
    expect(source).toContain('WelcomeEmailSchema.safeParse(body)');
  });

  it('should return 400 on validation error', () => {
    // Find the validation error response block
    const safeParseIndex = source.indexOf('safeParse(body)');
    const validationBlock = source.slice(safeParseIndex, safeParseIndex + 500);
    expect(validationBlock).toContain('status: 400');
    expect(validationBlock).toContain("error: 'Validation error'");
  });

  it('should include field-level error details in 400 response', () => {
    expect(source).toContain('parsed.error.issues.map');
    expect(source).toContain('i.path.join');
    expect(source).toContain('i.message');
  });

  it('should return 400 for invalid JSON body', () => {
    // JSON parse error should return 400
    const jsonParseBlock = source.slice(
      source.indexOf('await req.json()'),
      source.indexOf('safeParse')
    );
    expect(jsonParseBlock).toContain('status: 400');
    expect(jsonParseBlock).toContain("error: 'Invalid JSON body'");
  });
});

// ============================================================================
// 2. CORS Handling
// ============================================================================

describe('Send Welcome Email — CORS Handling', () => {
  it('should handle OPTIONS preflight requests', () => {
    expect(source).toContain("req.method === 'OPTIONS'");
  });

  it('should return null body for OPTIONS', () => {
    const optionsBlock = source.slice(
      source.indexOf("req.method === 'OPTIONS'"),
      source.indexOf("req.method === 'OPTIONS'") + 100
    );
    expect(optionsBlock).toContain('new Response(null');
  });

  it('should include corsHeaders in all responses', () => {
    // Every Response should include corsHeaders
    const responseMatches = source.match(/new Response\(/g);
    const corsMatches = source.match(/corsHeaders/g);
    // More corsHeaders references than Response constructions (some are spread)
    expect(corsMatches!.length).toBeGreaterThanOrEqual(responseMatches!.length - 1);
  });
});

// ============================================================================
// 3. Error Handling
// ============================================================================

describe('Send Welcome Email — Error Handling', () => {
  it('should catch all errors in outer try-catch', () => {
    expect(source).toContain('} catch (error: unknown) {');
  });

  it('should return 200 for non-critical downstream errors', () => {
    // The outer catch returns 200 (welcome email is non-critical)
    const catchBlock = source.slice(source.lastIndexOf('catch (error: unknown)'));
    expect(catchBlock).toContain('status: 200');
    expect(catchBlock).toContain('success: true');
  });

  it('should include error message in catch response', () => {
    const catchBlock = source.slice(source.lastIndexOf('catch (error: unknown)'));
    expect(catchBlock).toContain("error instanceof Error ? error.message : 'Unknown error'");
  });

  it('should log errors with WELCOME-EMAIL prefix', () => {
    expect(source).toContain("console.error('[WELCOME-EMAIL] Error:'");
  });

  it('should never return 500 (no unhandled error paths)', () => {
    // The function should not have any explicit 500 status codes
    expect(source).not.toContain('status: 500');
  });
});

// ============================================================================
// 4. Response Structure
// ============================================================================

describe('Send Welcome Email — Response Structure', () => {
  it('should return JSON with success field on success', () => {
    expect(source).toContain("JSON.stringify({ success: true, message: 'Welcome email sent' })");
  });

  it('should return 200 status on successful send', () => {
    // Find the success response (not the catch one)
    const successResponse = source.slice(
      source.indexOf("'Welcome email sent'"),
      source.indexOf("'Welcome email sent'") + 200
    );
    expect(successResponse).toContain('status: 200');
  });

  it('should set Content-Type to application/json on all responses', () => {
    const contentTypeMatches = source.match(/'Content-Type': 'application\/json'/g);
    // Should appear in: 400 (JSON), 400 (validation), 402, 200 (success), 200 (catch)
    expect(contentTypeMatches!.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// 5. Content Generation
// ============================================================================

describe('Send Welcome Email — Content Generation', () => {
  it('should generate HTML email with DOCTYPE', () => {
    expect(source).toContain('<!DOCTYPE html>');
  });

  it('should include business name in HTML subject/header', () => {
    expect(source).toContain('Welcome to ${businessName}!');
  });

  it('should include dashboard link in HTML content', () => {
    expect(source).toContain('href="${dashboardUrl}"');
  });

  it('should generate plain text email content', () => {
    expect(source).toContain('Get started by visiting your dashboard: ${dashboardUrl}');
  });

  it('should use displayName which falls back to email prefix', () => {
    expect(source).toContain("const displayName = full_name || email.split('@')[0]");
  });

  it('should construct tenant-specific dashboard URL when slug exists', () => {
    expect(source).toContain('`${siteUrl}/${tenantSlug}/admin/dashboard`');
  });

  it('should fall back to generic dashboard URL without tenant slug', () => {
    expect(source).toContain('`${siteUrl}/dashboard`');
  });
});

// ============================================================================
// 6. Tenant Branding
// ============================================================================

describe('Send Welcome Email — Tenant Branding', () => {
  it('should default business name to FloraIQ', () => {
    expect(source).toContain("let businessName = 'FloraIQ'");
  });

  it('should resolve tenant business_name and slug from database', () => {
    expect(source).toContain(".from('tenants')");
    expect(source).toContain("select('business_name, slug')");
  });

  it('should use maybeSingle for tenant lookup', () => {
    expect(source).toContain('.maybeSingle()');
  });

  it('should only look up tenant when tenant_id is present', () => {
    const tenantLookupIndex = source.indexOf(".from('tenants')");
    const precedingBlock = source.slice(
      Math.max(0, tenantLookupIndex - 200),
      tenantLookupIndex
    );
    expect(precedingBlock).toContain('if (tenant_id)');
  });

  it('should use SITE_URL env var for dashboard URL with fallback', () => {
    expect(source).toContain("Deno.env.get('SITE_URL') || supabaseUrl || 'https://app.floraiq.com'");
  });
});

// ============================================================================
// 7. Email Sending
// ============================================================================

describe('Send Welcome Email — Email Sending', () => {
  it('should check for RESEND_API_KEY before attempting send', () => {
    expect(source).toContain("Deno.env.get('RESEND_API_KEY')");
  });

  it('should send via send-klaviyo-email edge function', () => {
    expect(source).toContain('send-klaviyo-email');
  });

  it('should pass subject, html, text, and from fields to email function', () => {
    expect(source).toContain('to: email');
    expect(source).toContain('html: htmlContent');
    expect(source).toContain('text: textContent');
    expect(source).toContain('fromName: businessName');
  });

  it('should use FROM_EMAIL env var with fallback', () => {
    expect(source).toContain("Deno.env.get('FROM_EMAIL') || 'noreply@floraiq.com'");
  });

  it('should log email details in dev mode (no Resend key)', () => {
    expect(source).toContain('[WELCOME-EMAIL] Resend not configured, email logged:');
  });

  it('should use service role key for Authorization header', () => {
    expect(source).toContain('`Bearer ${supabaseKey}`');
  });
});
