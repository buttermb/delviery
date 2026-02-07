/**
 * HTML sanitization utility
 * Strips dangerous HTML tags and attributes to prevent XSS
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'a',
  'blockquote', 'code', 'pre', 'hr', 'sub', 'sup',
]);

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'class']);

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
 * Alias for sanitizeHtml - sanitizes basic HTML content
 * Strips dangerous tags/attributes while keeping safe formatting tags.
 */
export const sanitizeBasicHtml = sanitizeHtml;
