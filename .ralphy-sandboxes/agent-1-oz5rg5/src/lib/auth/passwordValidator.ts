/**
 * Password Validation Utility
 * Provides structured validation and strength assessment for passwords.
 * Used by signup and password reset forms.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  failures: string[];
}

export type PasswordStrength = 'weak' | 'medium' | 'strong';

const MIN_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_CHAR_REGEX = /[^a-zA-Z0-9]/;

/**
 * Validates a password against security requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @returns Object with isValid boolean and array of specific failure messages
 */
export function validatePassword(password: string): PasswordValidationResult {
  const failures: string[] = [];

  if (password.length < MIN_LENGTH) {
    failures.push(`Password must be at least ${MIN_LENGTH} characters`);
  }

  if (!UPPERCASE_REGEX.test(password)) {
    failures.push('Password must contain at least one uppercase letter');
  }

  if (!LOWERCASE_REGEX.test(password)) {
    failures.push('Password must contain at least one lowercase letter');
  }

  if (!NUMBER_REGEX.test(password)) {
    failures.push('Password must contain at least one number');
  }

  if (!SPECIAL_CHAR_REGEX.test(password)) {
    failures.push('Password must contain at least one special character');
  }

  return {
    isValid: failures.length === 0,
    failures,
  };
}

/**
 * Assesses password strength based on character diversity and length.
 *
 * - weak: Fewer than 3 criteria met
 * - medium: 3-4 criteria met
 * - strong: All 5 criteria met (length + uppercase + lowercase + number + special)
 */
export function getPasswordStrength(password: string): PasswordStrength {
  let criteriaMet = 0;

  if (password.length >= MIN_LENGTH) criteriaMet++;
  if (UPPERCASE_REGEX.test(password)) criteriaMet++;
  if (LOWERCASE_REGEX.test(password)) criteriaMet++;
  if (NUMBER_REGEX.test(password)) criteriaMet++;
  if (SPECIAL_CHAR_REGEX.test(password)) criteriaMet++;

  if (criteriaMet === 5) return 'strong';
  if (criteriaMet >= 3) return 'medium';
  return 'weak';
}
