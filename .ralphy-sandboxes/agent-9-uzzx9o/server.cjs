// Include AikidoSec firewall before any other imports (required)
require('@aikidosec/firewall');

const path = require('path');
const fs = require('fs');
const express = require('express');
const expressStaticGzip = require('express-static-gzip');

const app = express();
const PORT = process.env.PORT || 4173;
const DIST_PATH = path.resolve(__dirname, 'dist');
const INDEX_FILE = path.join(DIST_PATH, 'index.html');

if (!process.env.AIKIDO_TOKEN) {
   
  console.warn(
    '[AikidoSec] AIKIDO_TOKEN environment variable is not set. ' +
      'Requests will fail until the token is configured.',
  );
}

if (!fs.existsSync(DIST_PATH)) {
   
  console.warn(
    '[Server] dist/ folder not found. Run `npm run build` before starting the secure server.',
  );
}

app.disable('x-powered-by');

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(
  expressStaticGzip(DIST_PATH, {
    enableBrotli: true,
    orderPreference: ['br', 'gz'],
    serveStatic: {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    },
  }),
);

app.get('*', (_req, res, next) => {
  if (!fs.existsSync(INDEX_FILE)) {
    const error = new Error('Build output not found. Run `npm run build` first.');
    error.status = 500;
    return next(error);
  }
  return res.sendFile(INDEX_FILE);
});

app.use((err, _req, res, _next) => {
   
  console.error('[Server] Unhandled error', err);
  res.status(err.status || 500).json({
    error: 'Server error',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

app.listen(PORT, () => {
   
  console.log(`[Server] Secure server running on http://localhost:${PORT}`);
});

