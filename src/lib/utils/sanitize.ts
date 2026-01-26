/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses a simple allowlist approach for safe tags and attributes.
 */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  const ALLOWED_TAGS = new Set([
    'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'img',
  ]);
  const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'src', 'alt', 'class']);

  function walk(node: Node): void {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
          // Replace disallowed elements with their text content
          const text = document.createTextNode(el.textContent || '');
          node.replaceChild(text, child);
        } else {
          // Remove disallowed attributes
          const attrs = Array.from(el.attributes);
          for (const attr of attrs) {
            if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
              el.removeAttribute(attr.name);
            }
          }
          // Sanitize href to prevent javascript: URLs
          if (el.hasAttribute('href')) {
            const href = el.getAttribute('href') || '';
            if (href.toLowerCase().startsWith('javascript:')) {
              el.removeAttribute('href');
            }
          }
          walk(el);
        }
      }
    }
  }

  walk(div);
  return div.innerHTML;
}

/**
 * Strip all HTML tags, returning plain text
 */
export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/**
 * Sanitize user input for safe storage (strips angle brackets)
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
