/**
 * Form Validation Utilities
 * Common validation functions for auth forms
 */

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Please enter a valid email address" };
  }

  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password) {
    return { valid: false, errors: ["Password is required"] };
  }

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  if (password.length > 128) {
    errors.push("Password must be less than 128 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate password confirmation
 */
export function validatePasswordConfirm(
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } {
  if (!confirmPassword) {
    return { valid: false, error: "Please confirm your password" };
  }

  if (password !== confirmPassword) {
    return { valid: false, error: "Passwords do not match" };
  }

  return { valid: true };
}

/**
 * Validate tenant slug format
 */
export function validateTenantSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) {
    return { valid: false, error: "Tenant slug is required" };
  }

  if (!/^[a-z0-9_-]{3,50}$/.test(slug)) {
    return {
      valid: false,
      error: "Tenant slug must be 3-50 characters and contain only lowercase letters, numbers, hyphens, and underscores",
    };
  }

  return { valid: true };
}

/**
 * Validate phone number (basic)
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: true }; // Phone is optional
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");

  if (!/^\+?[1-9]\d{1,14}$/.test(cleaned)) {
    return {
      valid: false,
      error: "Please enter a valid phone number",
    };
  }

  return { valid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: string, fieldName: string): { valid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required` };
  }

  return { valid: true };
}

/**
 * Validate business name
 */
export function validateBusinessName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Business name is required" };
  }

  if (name.length < 2) {
    return { valid: false, error: "Business name must be at least 2 characters" };
  }

  if (name.length > 255) {
    return { valid: false, error: "Business name must be less than 255 characters" };
  }

  return { valid: true };
}

