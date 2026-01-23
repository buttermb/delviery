/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses a simple tag-stripping approach without DOMPurify dependency.
 */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowedTags = new Set([
    'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'img'
  ]);
  const allowedAttrs = new Set(['href', 'target', 'rel', 'src', 'alt', 'class', 'style']);

  function cleanNode(node: Node): void {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (!allowedTags.has(el.tagName.toLowerCase())) {
          el.replaceWith(...Array.from(el.childNodes));
        } else {
          const attrs = Array.from(el.attributes);
          for (const attr of attrs) {
            if (!allowedAttrs.has(attr.name.toLowerCase())) {
              el.removeAttribute(attr.name);
            }
          }
          cleanNode(el);
        }
      }
    }
  }

  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/**
 * Strip all HTML tags, returning plain text
 */
export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

/**
 * Sanitize user input for database storage
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
