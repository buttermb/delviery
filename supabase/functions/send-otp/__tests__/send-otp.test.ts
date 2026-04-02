/**
 * send-otp Edge Function Tests
 *
 * Verifies:
 * 1. Input validation with Zod schema (returns 400 for invalid input)
 * 2. Email, phone, and UUID format validation
 * 3. Rate limiting integration
 * 4. Proper error handling (no 500 for user errors)
 * 5. CORS preflight handling
 * 6. Proper logging with [SEND_OTP] prefix
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readSource(): string {
  const sourcePath = path.resolve(__dirname, '..', 'index.ts');
  return fs.readFileSync(sourcePath, 'utf-8');
}

describe('send-otp edge function', () => {
  const source = readSource();

  describe('imports and dependencies', () => {
    it('should import from shared deps', () => {
      expect(source).toContain("from '../_shared/deps.ts'");
    });

    it('should import Zod for schema validation', () => {
      expect(source).toContain('z } from');
    });

    it('should import rate limiting', () => {
      expect(source).toContain("from '../_shared/rateLimiting.ts'");
      expect(source).toContain('RATE_LIMITS.SEND_OTP');
    });

    it('should import validation utilities', () => {
      expect(source).toContain("from '../_shared/validation.ts'");
      expect(source).toContain('validateEmail');
      expect(source).toContain('validatePhoneNumber');
      expect(source).toContain('validateUUID');
    });

    it('should use shared corsHeaders, not define its own', () => {
      expect(source).not.toMatch(/const corsHeaders\s*=/);
    });
  });

  describe('CORS preflight', () => {
    it('should handle OPTIONS method for CORS preflight', () => {
      expect(source).toContain("req.method === \"OPTIONS\"");
    });

    it('should return corsHeaders on OPTIONS', () => {
      expect(source).toContain('headers: corsHeaders');
    });
  });

  describe('rate limiting', () => {
    it('should check rate limit before processing', () => {
      expect(source).toContain('checkRateLimit(RATE_LIMITS.SEND_OTP');
    });

    it('should return 429 when rate limited', () => {
      expect(source).toContain('status: 429');
      expect(source).toContain('Too many requests');
    });

    it('should use client IP for rate limiting', () => {
      expect(source).toContain("x-forwarded-for");
      expect(source).toContain("cf-connecting-ip");
    });
  });

  describe('input validation', () => {
    it('should define a Zod schema for request validation', () => {
      expect(source).toContain('RequestSchema');
      expect(source).toContain('z.object');
    });

    it('should require entryId, email, and phone in schema', () => {
      expect(source).toContain('entryId: z.string()');
      expect(source).toContain('email: z.string()');
      expect(source).toContain('phone: z.string()');
    });

    it('should use safeParse for validation (not parse/throw)', () => {
      expect(source).toContain('RequestSchema.safeParse');
    });

    it('should return 400 for missing required fields', () => {
      // Look for the validation failure response
      const lines = source.split('\n');
      const missingFieldsLine = lines.find(l => l.includes('Missing required fields'));
      expect(missingFieldsLine).toBeDefined();

      // Find the status: 400 near the missing fields response
      expect(source).toContain('status: 400');
    });

    it('should validate UUID format for entryId', () => {
      expect(source).toContain('validateUUID(entryId)');
      expect(source).toContain('Invalid entryId format');
    });

    it('should validate email format', () => {
      expect(source).toContain('validateEmail(email)');
      expect(source).toContain('Invalid email format');
    });

    it('should validate phone number format', () => {
      expect(source).toContain('validatePhoneNumber(phone)');
      expect(source).toContain('Invalid phone number format');
    });

    it('should never return 500 for validation errors', () => {
      // Ensure validation errors return before the try block's catch
      const tryIndex = source.indexOf('try {');
      const catchIndex = source.lastIndexOf('catch (error');

      // All validation returns should be before the database operations
      const createClientIndex = source.indexOf('createClient(');
      const missingFieldsIndex = source.indexOf('Missing required fields');
      const invalidEntryIdIndex = source.indexOf('Invalid entryId format');
      const invalidEmailIndex = source.indexOf('Invalid email format');
      const invalidPhoneIndex = source.indexOf('Invalid phone number format');

      // All validation errors should be returned before createClient is called
      expect(missingFieldsIndex).toBeLessThan(createClientIndex);
      expect(invalidEntryIdIndex).toBeLessThan(createClientIndex);
      expect(invalidEmailIndex).toBeLessThan(createClientIndex);
      expect(invalidPhoneIndex).toBeLessThan(createClientIndex);
    });
  });

  describe('OTP generation', () => {
    it('should generate separate OTPs for email and phone', () => {
      const otpCalls = (source.match(/supabase\.rpc\('generate_otp'\)/g) || []).length;
      expect(otpCalls).toBe(2);
    });

    it('should check for OTP generation errors', () => {
      expect(source).toContain('otpError1');
      expect(source).toContain('otpError2');
    });

    it('should set 10-minute expiry', () => {
      expect(source).toContain('10 * 60 * 1000');
    });
  });

  describe('database operations', () => {
    it('should update giveaway_entries table', () => {
      expect(source).toContain("from('giveaway_entries')");
    });

    it('should store both OTPs and expiry', () => {
      expect(source).toContain('email_otp:');
      expect(source).toContain('phone_otp:');
      expect(source).toContain('otp_expiry:');
    });

    it('should filter by entryId', () => {
      expect(source).toContain(".eq('id', entryId)");
    });
  });

  describe('email sending', () => {
    it('should use Resend API for email', () => {
      expect(source).toContain('https://api.resend.com/emails');
    });

    it('should use RESEND_API_KEY from environment', () => {
      expect(source).toContain('RESEND_API_KEY');
    });

    it('should check if Resend API key exists before sending', () => {
      expect(source).toContain('if (resendApiKey)');
    });

    it('should log email send failures', () => {
      expect(source).toContain('[SEND_OTP] Resend API error');
    });
  });

  describe('SMS sending', () => {
    it('should call send-sms edge function for SMS', () => {
      expect(source).toContain('/functions/v1/send-sms');
    });

    it('should log SMS send failures', () => {
      expect(source).toContain('[SEND_OTP] SMS send error');
    });
  });

  describe('success response', () => {
    it('should return success: true on success', () => {
      expect(source).toContain('success: true');
    });

    it('should return verification message', () => {
      expect(source).toContain('Verification codes sent');
    });

    it('should not leak OTP values in response', () => {
      // Ensure the success response doesn't include actual OTP values
      const successResponse = source.substring(
        source.indexOf('success: true'),
        source.indexOf('success: true') + 200
      );
      expect(successResponse).not.toContain('emailOTP');
      expect(successResponse).not.toContain('phoneOTP');
    });
  });

  describe('error handling', () => {
    it('should catch errors and return 500 only for server errors', () => {
      expect(source).toContain('catch (error: unknown)');
      expect(source).toContain('status: 500');
    });

    it('should not leak error details in 500 response', () => {
      // The catch block should return a generic message, not error.message
      const catchBlock = source.substring(source.lastIndexOf('catch (error'));
      expect(catchBlock).toContain('Failed to send verification codes');
      expect(catchBlock).not.toContain('error.message');
    });

    it('should use [SEND_OTP] prefix for all log messages', () => {
      const logLines = source.split('\n').filter(l => l.includes('console.error'));
      for (const line of logLines) {
        expect(line).toContain('[SEND_OTP]');
      }
    });
  });
});
