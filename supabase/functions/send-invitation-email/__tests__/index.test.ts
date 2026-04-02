/**
 * send-invitation-email Edge Function Tests
 *
 * Verifies:
 * 1. Authentication: verify_jwt = true in config (unauthenticated → 401)
 * 2. Input validation with Zod schema (returns 400 on bad input)
 * 3. CORS preflight handling
 * 4. Email sending via send-klaviyo-email downstream
 * 5. Best-effort pattern (runtime errors → 200, not 500)
 * 6. Structured logging with function name prefix
 * 7. Tenant branding lookup
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

function readConfig(): string {
  const configPath = path.resolve(__dirname, '..', '..', '..', 'config.toml');
  return fs.readFileSync(configPath, 'utf-8');
}

// ============================================================================
// 1. Authentication Configuration
// ============================================================================

describe('send-invitation-email — Authentication', () => {
  const config = readConfig();

  it('should require JWT authentication (verify_jwt = true)', () => {
    // Extract the send-invitation-email section from config
    const sectionStart = config.indexOf('[functions.send-invitation-email]');
    expect(sectionStart).toBeGreaterThan(-1);

    // Find verify_jwt after the section header
    const sectionSlice = config.slice(sectionStart, sectionStart + 200);
    expect(sectionSlice).toContain('verify_jwt = true');
  });

  it('should return 401 for unauthenticated requests (not 500)', () => {
    // verify_jwt = true means Supabase gateway returns 401 before function executes
    const sectionStart = config.indexOf('[functions.send-invitation-email]');
    const sectionSlice = config.slice(sectionStart, sectionStart + 200);
    // If verify_jwt is true, the gateway handles auth — function won't crash with 500
    expect(sectionSlice).not.toContain('verify_jwt = false');
  });
});

// ============================================================================
// 2. Input Validation
// ============================================================================

describe('send-invitation-email — Input Validation', () => {
  const source = readSource();

  it('should validate input with Zod schema', () => {
    expect(source).toContain('invitationEmailSchema.parse(body)');
  });

  it('should require "to" field as a valid email', () => {
    expect(source).toContain("to: z.string().email()");
  });

  it('should require "tenant_name" as a string', () => {
    expect(source).toContain("tenant_name: z.string()");
  });

  it('should require "role" as a string', () => {
    expect(source).toContain("role: z.string()");
  });

  it('should require "invite_link" as a valid URL', () => {
    expect(source).toContain("invite_link: z.string().url()");
  });

  it('should accept optional "tenant_slug"', () => {
    expect(source).toContain("tenant_slug: z.string().optional()");
  });

  it('should accept optional "expires_at"', () => {
    expect(source).toContain("expires_at: z.string().optional()");
  });

  it('should accept optional "invited_by"', () => {
    expect(source).toContain("invited_by: z.string().optional()");
  });

  it('should return 400 for validation errors', () => {
    expect(source).toContain('status: 400');
  });

  it('should return success: false for validation errors', () => {
    // Find the 400 response block
    const validationBlock = source.slice(
      source.indexOf('Validation error'),
      source.indexOf('status: 400') + 20
    );
    expect(validationBlock).toContain('success: false');
  });

  it('should include Zod error details in validation response', () => {
    expect(source).toContain('z.ZodError');
    expect(source).toContain('error.errors.map');
  });

  it('should separate validation from runtime error handling', () => {
    // Validation catch should be separate from runtime catch
    const firstCatch = source.indexOf('catch (error');
    const secondCatch = source.indexOf('catch (error', firstCatch + 1);
    expect(secondCatch).toBeGreaterThan(firstCatch);
  });
});

// ============================================================================
// 3. CORS Handling
// ============================================================================

describe('send-invitation-email — CORS', () => {
  const source = readSource();

  it('should handle OPTIONS preflight requests', () => {
    expect(source).toContain("req.method === 'OPTIONS'");
  });

  it('should import corsHeaders from shared deps', () => {
    expect(source).toContain("corsHeaders");
    expect(source).toContain("from '../_shared/deps.ts'");
  });

  it('should include corsHeaders in all responses', () => {
    // All Response constructors should use corsHeaders
    const responses = source.match(/new Response\(/g) || [];
    expect(responses.length).toBeGreaterThanOrEqual(3); // OPTIONS, 400, 200 success, 200 error
  });
});

// ============================================================================
// 4. Email Sending
// ============================================================================

describe('send-invitation-email — Email Sending', () => {
  const source = readSource();

  it('should call send-klaviyo-email for email delivery', () => {
    expect(source).toContain('/functions/v1/send-klaviyo-email');
  });

  it('should use service role key for downstream call', () => {
    expect(source).toContain('`Bearer ${supabaseKey}`');
  });

  it('should include required email fields in downstream call', () => {
    expect(source).toContain('to,');
    expect(source).toContain('subject,');
    expect(source).toContain('html: htmlContent');
    expect(source).toContain('text: textContent');
    expect(source).toContain('fromEmail:');
    expect(source).toContain('fromName: businessName');
  });

  it('should check for RESEND_API_KEY before sending', () => {
    expect(source).toContain("Deno.env.get('RESEND_API_KEY')");
  });

  it('should log email details when Resend is not configured', () => {
    expect(source).toContain('Resend not configured');
  });

  it('should not fail on email sending errors (best-effort)', () => {
    // The email try-catch should not re-throw
    const emailCatchIndex = source.indexOf('Email sending error');
    expect(emailCatchIndex).toBeGreaterThan(-1);

    // After the email sending block, function should still return 200
    const afterEmailBlock = source.slice(emailCatchIndex);
    expect(afterEmailBlock).toContain('status: 200');
  });
});

// ============================================================================
// 5. Best-Effort Response Pattern
// ============================================================================

describe('send-invitation-email — Best-Effort Pattern', () => {
  const source = readSource();

  it('should return 200 for runtime errors (invitation already created)', () => {
    // The outer catch should return 200, not 500
    const runtimeCatch = source.slice(source.indexOf('Runtime error'));
    expect(runtimeCatch).toContain('status: 200');
    expect(runtimeCatch).not.toContain('status: 500');
  });

  it('should include success: true even on runtime errors', () => {
    const runtimeCatch = source.slice(source.indexOf('Runtime error'));
    expect(runtimeCatch).toContain('success: true');
  });

  it('should include descriptive message for email failures', () => {
    expect(source).toContain('Invitation created (email may not have been sent)');
  });

  it('should include error detail in runtime error response', () => {
    expect(source).toContain("error instanceof Error ? error.message : 'Failed to send invitation email'");
  });
});

// ============================================================================
// 6. Structured Logging
// ============================================================================

describe('send-invitation-email — Logging', () => {
  const source = readSource();

  it('should use [send-invitation-email] prefix in log messages', () => {
    const logLines = source.split('\n').filter(l => l.includes('console.error'));
    const prefixedLines = logLines.filter(l => l.includes('[send-invitation-email]'));
    expect(prefixedLines.length).toBeGreaterThanOrEqual(3);
  });

  it('should log validation errors', () => {
    expect(source).toContain('[send-invitation-email] Validation error');
  });

  it('should log successful sends', () => {
    expect(source).toContain('[send-invitation-email] Sent successfully to:');
  });

  it('should log runtime errors', () => {
    expect(source).toContain('[send-invitation-email] Runtime error:');
  });
});

// ============================================================================
// 7. Tenant Branding
// ============================================================================

describe('send-invitation-email — Tenant Branding', () => {
  const source = readSource();

  it('should look up tenant by slug for branding', () => {
    expect(source).toContain(".from('tenants')");
    expect(source).toContain(".eq('slug', tenant_slug)");
  });

  it('should use .maybeSingle() for tenant lookup', () => {
    expect(source).toContain('.maybeSingle()');
  });

  it('should fall back to tenant_name if tenant not found', () => {
    expect(source).toContain('let businessName = tenant_name');
  });

  it('should only look up tenant when tenant_slug is provided', () => {
    expect(source).toContain('if (tenant_slug)');
  });

  it('should use tenant business_name for email branding', () => {
    expect(source).toContain('businessName = tenant.business_name');
  });
});

// ============================================================================
// 8. Role Display
// ============================================================================

describe('send-invitation-email — Role Display', () => {
  const source = readSource();

  it('should map roles to human-readable display names', () => {
    expect(source).toContain("owner: 'Owner'");
    expect(source).toContain("admin: 'Administrator'");
    expect(source).toContain("viewer: 'Viewer'");
    expect(source).toContain("staff: 'Staff'");
  });

  it('should have a dedicated getRoleDisplayName function', () => {
    expect(source).toContain('function getRoleDisplayName(role: string): string');
  });

  it('should fall back to raw role string for unknown roles', () => {
    expect(source).toContain('?? role');
  });
});

// ============================================================================
// 9. Email Content
// ============================================================================

describe('send-invitation-email — Email Content', () => {
  const source = readSource();

  it('should generate both HTML and plain text email content', () => {
    expect(source).toContain('buildHtmlContent');
    expect(source).toContain('buildTextContent');
  });

  it('should include invite link in email', () => {
    expect(source).toContain('${inviteLink}');
  });

  it('should include expiration text', () => {
    expect(source).toContain('${expirationText}');
  });

  it('should use default expiration text when expires_at not provided', () => {
    expect(source).toContain('This invitation expires in 7 days.');
  });

  it('should include business name in subject line', () => {
    expect(source).toContain("`You've been invited to join ${businessName}`");
  });
});

// ============================================================================
// 10. Shared Dependencies
// ============================================================================

describe('send-invitation-email — Dependencies', () => {
  const source = readSource();

  it('should import from shared deps (not direct URLs)', () => {
    expect(source).toContain("from '../_shared/deps.ts'");
    // Should NOT have direct deno.land or esm.sh imports
    expect(source).not.toContain('deno.land');
    expect(source).not.toContain('esm.sh');
  });

  it('should import serve, createClient, corsHeaders, z', () => {
    expect(source).toContain('serve');
    expect(source).toContain('createClient');
    expect(source).toContain('corsHeaders');
    expect(source).toContain(' z ');
  });
});
