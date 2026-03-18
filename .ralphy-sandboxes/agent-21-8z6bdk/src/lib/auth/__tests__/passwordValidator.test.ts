import { describe, it, expect } from 'vitest';
import { validatePassword, getPasswordStrength } from '../passwordValidator';

describe('validatePassword', () => {
  it('should return valid for a strong password meeting all criteria', () => {
    const result = validatePassword('MyP@ssw0rd');
    expect(result.isValid).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('should fail when password is too short', () => {
    const result = validatePassword('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.failures).toContain('Password must be at least 8 characters');
  });

  it('should fail when missing uppercase letter', () => {
    const result = validatePassword('myp@ssw0rd');
    expect(result.isValid).toBe(false);
    expect(result.failures).toContain('Password must contain at least one uppercase letter');
  });

  it('should fail when missing lowercase letter', () => {
    const result = validatePassword('MYP@SSW0RD');
    expect(result.isValid).toBe(false);
    expect(result.failures).toContain('Password must contain at least one lowercase letter');
  });

  it('should fail when missing a number', () => {
    const result = validatePassword('MyP@ssword');
    expect(result.isValid).toBe(false);
    expect(result.failures).toContain('Password must contain at least one number');
  });

  it('should fail when missing a special character', () => {
    const result = validatePassword('MyPassw0rd');
    expect(result.isValid).toBe(false);
    expect(result.failures).toContain('Password must contain at least one special character');
  });

  it('should return multiple failures for a very weak password', () => {
    const result = validatePassword('abc');
    expect(result.isValid).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(3);
    expect(result.failures).toContain('Password must be at least 8 characters');
    expect(result.failures).toContain('Password must contain at least one uppercase letter');
    expect(result.failures).toContain('Password must contain at least one number');
    expect(result.failures).toContain('Password must contain at least one special character');
  });

  it('should handle empty string', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.failures).toContain('Password must be at least 8 characters');
    expect(result.failures).toContain('Password must contain at least one uppercase letter');
    expect(result.failures).toContain('Password must contain at least one lowercase letter');
    expect(result.failures).toContain('Password must contain at least one number');
    expect(result.failures).toContain('Password must contain at least one special character');
  });

  it('should accept exactly 8 characters meeting all criteria', () => {
    const result = validatePassword('Ab1!xxxx');
    expect(result.isValid).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('should treat various special characters as valid', () => {
    const specials = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+', ' '];
    for (const special of specials) {
      const password = `Abcdefg1${special}`;
      const result = validatePassword(password);
      expect(result.failures).not.toContain('Password must contain at least one special character');
    }
  });
});

describe('getPasswordStrength', () => {
  it('should return strong when all 5 criteria are met', () => {
    expect(getPasswordStrength('MyP@ssw0rd')).toBe('strong');
  });

  it('should return medium when 3 criteria are met', () => {
    // lowercase + number + length = 3 criteria
    expect(getPasswordStrength('password1')).toBe('medium');
  });

  it('should return medium when 4 criteria are met', () => {
    // lowercase + uppercase + number + length = 4 criteria
    expect(getPasswordStrength('Password1')).toBe('medium');
  });

  it('should return weak when fewer than 3 criteria are met', () => {
    // only lowercase + length = 2 criteria
    expect(getPasswordStrength('password')).toBe('weak');
  });

  it('should return weak for empty string', () => {
    expect(getPasswordStrength('')).toBe('weak');
  });

  it('should return medium for short passwords meeting 4 criteria', () => {
    // uppercase + lowercase + number + special = 4 criteria, but not length
    expect(getPasswordStrength('Ab1!')).toBe('medium');
  });

  it('should return weak when only length and lowercase are met', () => {
    expect(getPasswordStrength('abcdefgh')).toBe('weak');
  });

  it('should return medium for short password with uppercase+lowercase+special', () => {
    // 3 criteria (uppercase + lowercase + special) but not length or number
    expect(getPasswordStrength('Ab!')).toBe('medium');
  });
});
