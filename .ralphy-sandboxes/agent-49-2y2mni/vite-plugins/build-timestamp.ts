import type { Plugin } from 'vite';

export function buildTimestampPlugin(): Plugin {
  return {
    name: 'build-timestamp',
    transformIndexHtml(html) {
      return html.replace('BUILD_TIMESTAMP', Date.now().toString());
    }
  };
}
