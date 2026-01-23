/**
 * Sanitization utilities for HTML content and form inputs.
 * Prevents XSS attacks and ensures safe data handling across all forms.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'a',
  'blockquote', 'code', 'pre', 'hr', 'sub', 'sup',
]);

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'class']);

const BASIC_HTML_TAGS = new Set(['b', 'i', 'em', 'strong', 'u', 'br', 'span', 'p']);

/**
 * Sanitize HTML string by removing dangerous tags and attributes.
 * Only allows a safe subset of HTML for rendering product descriptions.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

  // Remove data: URLs (potential XSS vector)
  sanitized = sanitized.replace(/href\s*=\s*["']data:[^"']*["']/gi, 'href="#"');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove iframe, object, embed tags
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|textarea|button)\b[^>]*>.*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|textarea|button)\b[^>]*\/?>/gi, '');

  // Add rel="noopener noreferrer" to links and open in new tab
  sanitized = sanitized.replace(
    /<a\b([^>]*)>/gi,
    (match, attrs) => {
      const hasTarget = /target\s*=/i.test(attrs);
      const hasRel = /rel\s*=/i.test(attrs);
      let newAttrs = attrs;
      if (!hasTarget) newAttrs += ' target="_blank"';
      if (!hasRel) newAttrs += ' rel="noopener noreferrer"';
      return `<a${newAttrs}>`;
    }
  );

  return sanitized;
}

/**
 * Sanitize basic HTML - allows only basic formatting tags (b, i, em, strong, u, br, span, p).
 * Used for rendering simple rich text content like subheadings.
 */
export function sanitizeBasicHtml(html: string): string {
  if (!html) return '';

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove style tags
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Strip all tags except basic formatting ones
  sanitized = sanitized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
    if (BASIC_HTML_TAGS.has(tag.toLowerCase())) {
      // For allowed tags, strip all attributes except class
      return match.replace(/\s+(?!class\s*=)[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
    }
    return '';
  });

  return sanitized;
}

/**
 * Sanitize a plain text form input value.
 * Trims whitespace, enforces max length, and removes HTML/script injection attempts.
 */
export function sanitizeFormInput(input: string, maxLength: number = 255): string {
  if (!input) return '';

  let sanitized = input.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove HTML tags entirely (form inputs should not contain HTML)
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove common script injection patterns
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/data\s*:/gi, '');
  sanitized = sanitized.replace(/vbscript\s*:/gi, '');

  // Encode remaining angle brackets to prevent any HTML interpretation
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Enforce max length
  sanitized = sanitized.slice(0, maxLength);

  return sanitized;
}

/**
 * Sanitize an email input value.
 * Trims, lowercases, and removes dangerous characters.
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';

  return email
    .trim()
    .toLowerCase()
    .replace(/[<>'"`;(){}[\]\\]/g, '')
    .slice(0, 255);
}

/**
 * Sanitize a numeric string input.
 * Only allows digits, decimal points, and optional leading minus sign.
 */
export function sanitizeNumericInput(input: string): string {
  if (!input) return '';
  return input.replace(/[^0-9.\-]/g, '').slice(0, 50);
}

/**
 * Sanitize a phone number input.
 * Only allows digits, plus sign, spaces, hyphens, and parentheses.
 */
export function sanitizePhoneInput(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^0-9+\s\-().]/g, '').slice(0, 20);
}

/**
 * Sanitize a URL input.
 * Trims and removes dangerous URL schemes.
 */
export function sanitizeUrlInput(url: string): string {
  if (!url) return '';

  const trimmed = url.trim().slice(0, 2048);

  // Block dangerous URL schemes
  if (/^(javascript|data|vbscript)\s*:/i.test(trimmed)) {
    return '';
  }

  return trimmed;
}

/**
 * Sanitize a slug/identifier input.
 * Only allows lowercase alphanumeric, hyphens, and underscores.
 */
export function sanitizeSlugInput(slug: string): string {
  if (!slug) return '';
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 100);
}

/**
 * Sanitize a textarea/multi-line input.
 * Allows newlines but removes HTML and dangerous content.
 */
export function sanitizeTextareaInput(input: string, maxLength: number = 2000): string {
  if (!input) return '';

  let sanitized = input.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove script injection patterns
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/data\s*:/gi, '');
  sanitized = sanitized.replace(/vbscript\s*:/gi, '');

  // Encode angle brackets
  sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Normalize excessive newlines (max 2 consecutive)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  // Enforce max length
  sanitized = sanitized.slice(0, maxLength);

  return sanitized;
}

/**
 * Sanitize a coupon/code input.
 * Only allows alphanumeric characters, hyphens, and underscores. Uppercases.
 */
export function sanitizeCouponCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 50);
}

/**
 * Sanitize a SKU input.
 * Only allows uppercase alphanumeric and hyphens.
 */
export function sanitizeSkuInput(sku: string): string {
  if (!sku) return '';
  return sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 50);
}

/**
 * Sanitize a currency/price input.
 * Only allows digits and a single decimal point.
 */
export function sanitizePriceInput(input: string): string {
  if (!input) return '';
  // Remove everything except digits and decimal point
  let sanitized = input.replace(/[^0-9.]/g, '');
  // Ensure only one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = parts[0] + '.' + parts.slice(1).join('');
  }
  return sanitized.slice(0, 15);
}

/**
 * Sanitize all string fields in a form data object.
 * Applies sanitizeFormInput to all string values, with optional
 * field-specific overrides.
 */
export function sanitizeFormData<T extends Record<string, unknown>>(
  data: T,
  fieldOverrides?: Partial<Record<keyof T, (value: string) => string>>
): T {
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized) as Array<keyof T>) {
    const value = sanitized[key];
    if (typeof value === 'string') {
      const overrideFn = fieldOverrides?.[key];
      if (overrideFn) {
        (sanitized as Record<keyof T, unknown>)[key] = overrideFn(value);
      } else {
        (sanitized as Record<keyof T, unknown>)[key] = sanitizeFormInput(value);
      }
    }
  }

  return sanitized;
}
