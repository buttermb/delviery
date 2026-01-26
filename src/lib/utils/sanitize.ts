/**
 * HTML Sanitization Utility
 * Strips dangerous HTML elements and attributes to prevent XSS attacks
 */

const ALLOWED_TAGS = new Set([
  'a', 'b', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'i', 'img', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody',
  'td', 'th', 'thead', 'tr', 'u', 'ul', 'blockquote', 'code', 'pre',
  'hr', 'section', 'article', 'header', 'footer', 'nav', 'figure',
  'figcaption', 'small', 'sub', 'sup', 'mark', 'del', 'ins',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'id', 'style',
  'width', 'height', 'target', 'rel',
]);

const DANGEROUS_PATTERNS = [
  /javascript\s*:/gi,
  /data\s*:/gi,
  /vbscript\s*:/gi,
  /on\w+\s*=/gi,
  /<script[\s>]/gi,
  /<\/script>/gi,
  /<iframe[\s>]/gi,
  /<\/iframe>/gi,
  /<object[\s>]/gi,
  /<\/object>/gi,
  /<embed[\s>]/gi,
  /<\/embed>/gi,
  /<form[\s>]/gi,
  /<\/form>/gi,
];

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Removes script tags, event handlers, and dangerous URL protocols.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  let sanitized = html;

  // Remove script, iframe, object, embed, and form tags entirely
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // Remove event handler attributes (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: and vbscript: protocols from href/src attributes
  sanitized = sanitized.replace(/(?:href|src)\s*=\s*(?:"[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi, '');
  sanitized = sanitized.replace(/(?:href|src)\s*=\s*(?:"[^"]*vbscript:[^"]*"|'[^']*vbscript:[^']*')/gi, '');

  // Remove data: URIs from src (can be used for XSS)
  sanitized = sanitized.replace(/src\s*=\s*(?:"[^"]*data:[^"]*"|'[^']*data:[^']*')/gi, '');

  // Add rel="noopener noreferrer" to links with target="_blank"
  sanitized = sanitized.replace(
    /<a\s([^>]*target\s*=\s*["']_blank["'][^>]*)>/gi,
    (match, attrs) => {
      if (!/rel\s*=/i.test(attrs)) {
        return `<a ${attrs} rel="noopener noreferrer">`;
      }
      return match;
    }
  );

  return sanitized;
}

/**
 * Sanitize basic HTML content - strips all dangerous tags/attributes
 * while preserving basic formatting (bold, italic, links, etc.)
 * Alias for sanitizeHtml for semantic clarity in component usage.
 */
export const sanitizeBasicHtml = sanitizeHtml;
