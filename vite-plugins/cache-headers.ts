/**
 * Plugin to add cache control headers for optimal performance
 */
export function cacheHeadersPlugin() {
  return {
    name: 'cache-headers-plugin',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Static assets (JS, CSS, images) - long cache
        if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // HTML - no cache, always revalidate
        else if (req.url.match(/\.html$/) || req.url === '/') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        next();
      });
    },
    configurePreviewServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        else if (req.url.match(/\.html$/) || req.url === '/') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        next();
      });
    },
  };
}
