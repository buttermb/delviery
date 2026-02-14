import type { Plugin } from 'vite';

/**
 * Vite plugin to defer CSS loading and eliminate render-blocking
 * Transforms CSS link tags to use media="print" onload trick
 */
export function deferCssPlugin(): Plugin {
  return {
    name: 'defer-css',
    transformIndexHtml(html) {
      // Replace CSS link tags with deferred loading
      return html.replace(
        /<link\s+rel="stylesheet"\s+([^>]*?)href="([^"]+\.css)"([^>]*?)>/gi,
        (match, before, href, after) => {
          // Only defer external CSS files (from assets folder)
          if (href.includes('/assets/')) {
            return `<link rel="preload" ${before}href="${href}"${after} as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" ${before}href="${href}"${after}></noscript>`;
          }
          return match;
        }
      );
    },
  };
}
