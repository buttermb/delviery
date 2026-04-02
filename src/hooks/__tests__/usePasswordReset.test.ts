/**
 * Password Reset Hook Tests
 *
 * Unit tests for validatePasswordStrength exported from usePasswordReset.
 * Tests password strength validation rules:
 * - Minimum length (8 characters)
 * - Maximum length (128 characters)
 * - Uppercase letter requirement
 * - Lowercase letter requirement
 * - Number requirement
 * - Special character requirement
 * - Score calculation
 */

import { describe, it, expect, vi } from "vitest";

// Mock dependencies that trigger Supabase client initialization
vi.mock("@/lib/utils/apiClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/utils/errorHandling/typeGuards", () => ({
  getErrorMessage: (e: unknown) => e instanceof Error ? e.message : String(e),
}));

import { validatePasswordStrength } from "@/hooks/usePasswordReset";

describe("validatePasswordStrength", () => {
  describe("valid passwords", () => {
    it("should accept a strong password with all requirements met", () => {
      const result = validatePasswordStrength("MyP@ssw0rd!");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBe(5);
    });

    it("should accept minimum length password (8 chars) with all requirements", () => {
      const result = validatePasswordStrength("Abcd12!@");
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept a long password within limits", () => {
      const result = validatePasswordStrength("A1!" + "a".repeat(100));
      expect(result.isValid).toBe(true);
    });

    it("should accept password at exactly 128 characters", () => {
      // 128 chars total: uppercase + lowercase + number + special + fill
      const result = validatePasswordStrength("Aa1!" + "x".repeat(124));
      expect(result.isValid).toBe(true);
    });
  });

  describe("minimum length", () => {
    it("should reject empty password", () => {
      const result = validatePasswordStrength("");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must be at least 8 characters");
    });

    it("should reject 7-character password", () => {
      const result = validatePasswordStrength("Ab1!abc");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must be at least 8 characters");
    });

    it("should accept exactly 8-character password with all requirements", () => {
      const result = validatePasswordStrength("Ab1!cdef");
      expect(result.isValid).toBe(true);
    });
  });

  describe("maximum length", () => {
    it("should reject password exceeding 128 characters", () => {
      const result = validatePasswordStrength("Aa1!" + "x".repeat(125));
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must be no more than 128 characters");
    });
  });

  describe("uppercase requirement", () => {
    it("should reject password without uppercase letters", () => {
      const result = validatePasswordStrength("abcdef1!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one uppercase letter");
    });
  });

  describe("lowercase requirement", () => {
    it("should reject password without lowercase letters", () => {
      const result = validatePasswordStrength("ABCDEF1!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one lowercase letter");
    });
  });

  describe("number requirement", () => {
    it("should reject password without numbers", () => {
      const result = validatePasswordStrength("Abcdefg!");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one number");
    });
  });

  describe("special character requirement", () => {
    it("should reject password without special characters", () => {
      const result = validatePasswordStrength("Abcdefg1");
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one special character");
    });

    it("should accept various special characters", () => {
      const specials = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "=", "+"];
      for (const special of specials) {
        const result = validatePasswordStrength(`Abcde1${special}x`);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe("score calculation", () => {
    it("should return score 0 for password failing all checks", () => {
      const result = validatePasswordStrength("");
      expect(result.score).toBe(0);
    });

    it("should increment score for each met requirement", () => {
      // Only length met (8+ chars, all lowercase)
      const lengthOnly = validatePasswordStrength("abcdefghij");
      expect(lengthOnly.score).toBe(2); // length + lowercase

      // Length + uppercase + lowercase
      const withUpper = validatePasswordStrength("Abcdefghij");
      expect(withUpper.score).toBe(3);

      // All five requirements
      const allMet = validatePasswordStrength("Abcde1!xx");
      expect(allMet.score).toBe(5);
    });

    it("should return score 5 for a perfect password", () => {
      const result = validatePasswordStrength("StrongP@ss1");
      expect(result.score).toBe(5);
    });
  });

  describe("multiple errors", () => {
    it("should return all applicable errors at once", () => {
      const result = validatePasswordStrength("short");
      expect(result.isValid).toBe(false);
      // Should have errors for: length, uppercase, number, special char
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
