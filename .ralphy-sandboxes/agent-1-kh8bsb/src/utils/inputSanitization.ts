/**
 * Input Sanitization Utilities
 * Secure input handling to prevent XSS, injection, and other attacks
 */

// ============================================================================
// HTML/XSS SANITIZATION
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return str.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char]);
}

/**
 * Remove all HTML tags from a string
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize HTML allowing only safe tags
 */
export function sanitizeHtml(
  str: string,
  allowedTags: string[] = ['b', 'i', 'u', 'strong', 'em', 'br', 'p']
): string {
  const tagPattern = new RegExp(
    `<(?!\/?(${allowedTags.join('|')})(?=>|\\s[^>]*>))[^>]+>`,
    'gi'
  );
  return str.replace(tagPattern, '');
}

// ============================================================================
// URL SANITIZATION
// ============================================================================

const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Sanitize URL to prevent javascript: and data: attacks
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim().toLowerCase();

  // Check for dangerous protocols
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    return '';
  }

  try {
    const parsed = new URL(url, window.location.origin);
    if (!SAFE_URL_PROTOCOLS.includes(parsed.protocol)) {
      return '';
    }
    return url;
  } catch {
    // If URL parsing fails, it might be a relative URL which is safe
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return url;
    }
    return '';
  }
}

/**
 * Validate and sanitize a URL for external links
 */
export function sanitizeExternalUrl(url: string): string {
  const sanitized = sanitizeUrl(url);
  if (!sanitized) return '';

  try {
    const parsed = new URL(sanitized, window.location.origin);
    // Only allow http/https for external links
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return sanitized;
  } catch {
    return '';
  }
}

// ============================================================================
// SQL INJECTION PREVENTION
// ============================================================================

/**
 * Escape SQL special characters (for display purposes only - use parameterized queries!)
 */
export function escapeSqlLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * Validate that a string is safe for use in SQL LIKE patterns
 */
export function isSafeSqlPattern(str: string): boolean {
  // Disallow SQL injection patterns
  const dangerousPatterns = [
    /--/,           // SQL comment
    /;/,            // Statement terminator
    /\/\*/,         // Block comment start
    /\*\//,         // Block comment end
    /xp_/i,         // SQL Server extended procedures
    /exec\s/i,      // Execute statement
    /union\s/i,     // UNION injection
    /select\s/i,    // SELECT injection
    /insert\s/i,    // INSERT injection
    /update\s/i,    // UPDATE injection
    /delete\s/i,    // DELETE injection
    /drop\s/i,      // DROP injection
  ];

  return !dangerousPatterns.some(pattern => pattern.test(str));
}

// ============================================================================
// PHONE & EMAIL VALIDATION
// ============================================================================

/**
 * Sanitize and format phone number
 */
export function sanitizePhone(phone: string): string {
  // Remove all non-digit characters except + at start
  const cleaned = phone.replace(/(?!^\+)\D/g, '');

  // Validate length (7-15 digits per E.164)
  if (cleaned.replace(/\D/g, '').length < 7 || cleaned.replace(/\D/g, '').length > 15) {
    return '';
  }

  return cleaned;
}

/**
 * Format phone number for display
 */
export function formatPhone(phone: string): string {
  const cleaned = sanitizePhone(phone);
  if (!cleaned) return '';

  const digits = cleaned.replace(/\D/g, '');

  // US format
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // International with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  return cleaned;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 compliant regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  return isValidEmail(trimmed) ? trimmed : '';
}

// ============================================================================
// TEXT SANITIZATION
// ============================================================================

/**
 * Remove control characters and null bytes
 */
export function removeControlChars(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Normalize whitespace (collapse multiple spaces, trim)
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitize text input (general purpose)
 */
export function sanitizeText(str: string, options: {
  maxLength?: number;
  allowNewlines?: boolean;
  allowHtml?: boolean;
} = {}): string {
  let result = str;

  // Remove control characters
  result = removeControlChars(result);

  // Strip HTML if not allowed
  if (!options.allowHtml) {
    result = stripHtml(result);
  }

  // Handle newlines
  if (!options.allowNewlines) {
    result = result.replace(/[\r\n]/g, ' ');
  }

  // Normalize whitespace
  result = normalizeWhitespace(result);

  // Truncate if needed
  if (options.maxLength && result.length > options.maxLength) {
    result = result.slice(0, options.maxLength);
  }

  return result;
}

/**
 * Sanitize for use in filenames
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Replace dangerous chars
    .replace(/\.+/g, '.') // Collapse multiple dots
    .replace(/^\./, '_') // Don't start with dot
    .replace(/\s+/g, '_') // Replace spaces
    .slice(0, 255); // Max filename length
}

// ============================================================================
// NUMBER SANITIZATION
// ============================================================================

/**
 * Parse and validate integer
 */
export function sanitizeInt(value: string | number, options: {
  min?: number;
  max?: number;
  defaultValue?: number;
} = {}): number {
  const { min = -Infinity, max = Infinity, defaultValue = 0 } = options;

  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);

  if (isNaN(parsed)) return defaultValue;
  if (parsed < min) return min;
  if (parsed > max) return max;

  return Math.floor(parsed);
}

/**
 * Parse and validate float
 */
export function sanitizeFloat(value: string | number, options: {
  min?: number;
  max?: number;
  decimals?: number;
  defaultValue?: number;
} = {}): number {
  const { min = -Infinity, max = Infinity, decimals = 2, defaultValue = 0 } = options;

  const parsed = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(parsed)) return defaultValue;

  let result = parsed;
  if (result < min) result = min;
  if (result > max) result = max;

  return Number(result.toFixed(decimals));
}

/**
 * Sanitize currency input
 */
export function sanitizeCurrency(value: string | number): number {
  // Remove currency symbols and commas
  const cleaned = String(value).replace(/[$,€£¥]/g, '');
  return sanitizeFloat(cleaned, { min: 0, decimals: 2 });
}

// ============================================================================
// JSON SANITIZATION
// ============================================================================

/**
 * Safely parse JSON with validation
 */
export function safeJsonParse<T>(
  json: string,
  validator?: (data: unknown) => data is T
): T | null {
  try {
    const parsed = JSON.parse(json);
    if (validator && !validator(parsed)) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

/**
 * Sanitize object by removing undefined and null values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    removeNull?: boolean;
    removeUndefined?: boolean;
    removeEmptyStrings?: boolean;
    deep?: boolean;
  } = {}
): Partial<T> {
  const {
    removeNull = true,
    removeUndefined = true,
    removeEmptyStrings = false,
    deep = false,
  } = options;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (removeNull && value === null) continue;
    if (removeUndefined && value === undefined) continue;
    if (removeEmptyStrings && value === '') continue;

    if (deep && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

// ============================================================================
// FORM DATA SANITIZATION
// ============================================================================

export interface FormSanitizationRules {
  [field: string]: {
    type: 'text' | 'email' | 'phone' | 'url' | 'int' | 'float' | 'currency' | 'boolean';
    required?: boolean;
    maxLength?: number;
    min?: number;
    max?: number;
    allowHtml?: boolean;
  };
}

export interface SanitizedFormResult {
  data: Record<string, unknown>;
  errors: Record<string, string>;
  isValid: boolean;
}

/**
 * Sanitize form data according to rules
 */
export function sanitizeFormData(
  formData: Record<string, unknown>,
  rules: FormSanitizationRules
): SanitizedFormResult {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = formData[field];

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field} is required`;
      continue;
    }

    // Skip empty non-required fields
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Sanitize based on type
    switch (rule.type) {
      case 'text':
        data[field] = sanitizeText(String(value), {
          maxLength: rule.maxLength,
          allowHtml: rule.allowHtml,
        });
        break;

      case 'email':
        const email = sanitizeEmail(String(value));
        if (!email && rule.required) {
          errors[field] = 'Invalid email address';
        } else {
          data[field] = email;
        }
        break;

      case 'phone':
        const phone = sanitizePhone(String(value));
        if (!phone && rule.required) {
          errors[field] = 'Invalid phone number';
        } else {
          data[field] = phone;
        }
        break;

      case 'url':
        const url = sanitizeUrl(String(value));
        if (!url && rule.required) {
          errors[field] = 'Invalid URL';
        } else {
          data[field] = url;
        }
        break;

      case 'int':
        data[field] = sanitizeInt(value as string | number, {
          min: rule.min,
          max: rule.max,
        });
        break;

      case 'float':
      case 'currency':
        data[field] = rule.type === 'currency'
          ? sanitizeCurrency(value as string | number)
          : sanitizeFloat(value as string | number, { min: rule.min, max: rule.max });
        break;

      case 'boolean':
        data[field] = Boolean(value);
        break;
    }
  }

  return {
    data,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}
