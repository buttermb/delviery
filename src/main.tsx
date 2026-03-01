import { logger } from '@/lib/logger';
/**
 * Delivery Platform - Main Entry Point
 * 
 * Framework: React 18 + TypeScript + Vite 5.0
 * State: TanStack Query | Styling: Tailwind CSS
 */

/**
 * NOTE: Zen Firewall (AikidoSec) is installed but designed for Node.js/Express backend servers.
 * This is a React frontend application. Zen should be set up on your backend server.
 *
 * See ZEN_FIREWALL_SETUP.md for backend setup instructions.
 * Configure AIKIDO_TOKEN environment variable on your backend server.
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeSecurityObfuscation } from "./utils/securityObfuscation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import bugFinder from "./utils/bugFinder";
import { setupGlobalErrorHandlers } from "./lib/globalErrorHandler";
import { STORAGE_KEYS } from "@/constants/storageKeys";

const runDeferred = (task: () => void, timeout = 1500) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as Window & {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback(task, { timeout });
    return;
  }
  (window ?? globalThis).setTimeout(task, 0);
};

// Setup global error handlers
setupGlobalErrorHandlers();

// Chunk loading error recovery with retry limit
let chunkReloadCount = 0;
const MAX_CHUNK_RELOADS = 3;

window.addEventListener('error', (event) => {
  const errorMessage = event.message ?? '';
  const isChunkError = errorMessage.includes('chunk') ||
    errorMessage.toLowerCase().includes('loading chunk') ||
    errorMessage.toLowerCase().includes('loading module') ||
    errorMessage.includes('createContext') ||
    (event.filename && event.filename.includes('chunk'));

  if (isChunkError && chunkReloadCount < MAX_CHUNK_RELOADS) {
    chunkReloadCount++;
    logger.error('Chunk loading failed', new Error(errorMessage), { component: 'main' });

    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.id = 'chunk-loading-error';
    errorDiv.textContent = '⚠️ Loading error detected. Reloading page...';
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:white;padding:1rem;text-align:center;z-index:9999;font-family:system-ui,sans-serif;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.2)';
    document.body.appendChild(errorDiv);

    // Reload with cache bypass after 2 seconds
    setTimeout(() => {
      const currentPath = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('nocache', Date.now().toString());
      window.location.href = `${currentPath}?${searchParams.toString()}`;
    }, 2000);
  } else if (isChunkError && chunkReloadCount >= MAX_CHUNK_RELOADS) {
    // Max reloads reached - show permanent error
    logger.error('Chunk loading failed after max reload attempts', new Error(errorMessage), { component: 'main' });

    const errorDiv = document.createElement('div');
    errorDiv.id = 'chunk-loading-error-permanent';
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;z-index:99999;padding:1rem';

    // Build error UI safely without innerHTML
    const container = document.createElement('div');
    container.style.cssText = 'max-width:600px;margin:2rem auto;padding:2rem;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:system-ui,sans-serif;';

    const heading = document.createElement('h2');
    heading.style.cssText = 'color:#dc2626;margin:0 0 1rem 0;';
    heading.textContent = '⚠️ Loading Error';
    container.appendChild(heading);

    const description = document.createElement('p');
    description.style.cssText = 'color:#374151;margin:0 0 1.5rem 0;line-height:1.6;';
    description.textContent = 'The application failed to load after multiple attempts. Please try:';
    container.appendChild(description);

    const list = document.createElement('ul');
    list.style.cssText = 'color:#374151;margin:0 0 1.5rem 0;padding-left:1.5rem;line-height:1.8;';
    ['Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)', 'Clear browser cache and reload', 'Try an incognito/private window'].forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
    container.appendChild(list);

    const button = document.createElement('button');
    button.style.cssText = 'width:100%;padding:12px;background:#10b981;color:white;border:none;border-radius:6px;font-size:16px;font-weight:500;cursor:pointer;';
    button.textContent = 'Reload Page';
    button.addEventListener('click', () => location.reload());
    container.appendChild(button);

    errorDiv.appendChild(container);
    document.body.appendChild(errorDiv);
  }
});

// Fix encoded URLs BEFORE React Router processes them
// This catches URLs like /select-plan%3Ftenant_id=xxx and fixes them immediately
(function fixEncodedUrl() {
  const currentPath = window.location.pathname;

  // Check if path contains encoded query string characters
  if (currentPath.includes('%3F') || currentPath.includes('%3D') || currentPath.includes('%26')) {
    const decodedPath = decodeURIComponent(currentPath);

    // If decoded path contains ?, split and redirect
    if (decodedPath.includes('?')) {
      const [path, queryString] = decodedPath.split('?');
      const existingSearch = window.location.search ? window.location.search.substring(1) : '';
      const newSearch = existingSearch ? `${queryString}&${existingSearch}` : queryString;
      const newUrl = `${path}?${newSearch}${window.location.hash}`;

      logger.info('[URL_FIX] Fixing encoded URL before React mounts', {
        from: window.location.href,
        to: newUrl
      });

      // Use replaceState to fix URL without page reload
      window.history.replaceState(null, '', newUrl);
    }
  }
})();

// Log app initialization
logger.debug('[APP] Starting app initialization...');

// Debug: Log theme state during initialization
logger.debug('[APP] Theme state:', {
  localStorage: localStorage.getItem(STORAGE_KEYS.THEME),
  htmlClasses: document.documentElement.className,
  prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches
});

// Initialize security obfuscation in production
if (import.meta.env.PROD) {
  try {
    initializeSecurityObfuscation();
  } catch (error) {
    logger.error('[APP] Security obfuscation failed:', error);
  }
}

// Register custom service worker (production only)
// IMPORTANT: This must run BEFORE React renders to prevent hook order issues
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Unregister any existing Workbox service workers first
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      // Unregister Workbox service workers (they have 'workbox' in scope or scriptURL)
      if (registration.scope.includes('workbox') ||
        registration.active?.scriptURL?.includes('workbox') ||
        registration.waiting?.scriptURL?.includes('workbox') ||
        registration.installing?.scriptURL?.includes('workbox')) {
        registration.unregister();
      }
    });
  });

  // Register custom service worker after a short delay to ensure cleanup happens first
  window.addEventListener('load', async () => {
    try {
      // Small delay to ensure Workbox cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Register custom service worker
      const registration = await navigator.serviceWorker.register('/sw.js?v=14'); // Bump version to clear cache and fix React Error #310
      logger.debug('[APP] Custom ServiceWorker registered', {
        scope: registration.scope,
        component: 'main'
      });

      // Only activate new service workers, don't force reload
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      logger.error('[APP] ServiceWorker registration failed', error instanceof Error ? error : new Error(String(error)), { component: 'main' });
    }
  });
}

// Initialize bug finder (runs in all environments)
try {
  // BugFinder automatically starts monitoring on instantiation
  logger.debug('[APP] Bug Finder initialized');

  // Defer dev-only bug scanning until idle to keep initial render responsive
  if (import.meta.env.DEV) {
    runDeferred(() => {
      const scan = bugFinder.scanBugs();
      if (scan.totalBugs > 0) {
        logger.warn('[APP] Existing bugs detected:', scan);
      }
    });
  }
} catch (error) {
  logger.error('[APP] Bug Finder initialization failed:', error);
}

// Render application with error handling
try {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error('Root element not found');
  }

  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (error) {
  logger.error('[APP] Fatal initialization error', error instanceof Error ? error : new Error(String(error)), { component: 'main' });

  if (import.meta.env.DEV) {
    logger.debug('Initialization error details', { error: error instanceof Error ? error.message : String(error), component: 'main' });
  }

  // Display user-friendly error message safely without innerHTML
  const rootElement = document.getElementById("root");
  if (rootElement) {
    // Clear existing content
    rootElement.textContent = '';

    // Build error UI safely
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; font-family: system-ui, -apple-system, sans-serif;';

    const card = document.createElement('div');
    card.style.cssText = 'max-width: 500px; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; background: white;';

    const title = document.createElement('h1');
    title.style.cssText = 'color: #dc2626; margin: 0 0 16px 0; font-size: 24px;';
    title.textContent = '⚠️ Failed to Load';
    card.appendChild(title);

    const desc = document.createElement('p');
    desc.style.cssText = 'color: #374151; margin: 0 0 20px 0; line-height: 1.5;';
    desc.textContent = 'We encountered an error while loading the app. Please try:';
    card.appendChild(desc);

    const list = document.createElement('ul');
    list.style.cssText = 'color: #374151; margin: 0 0 20px 0; line-height: 1.8;';
    ['Refreshing the page', 'Clearing your browser cache', 'Using an incognito/private window'].forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
    card.appendChild(list);

    const button = document.createElement('button');
    button.style.cssText = 'width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer;';
    button.textContent = 'Reload Page';
    button.addEventListener('click', () => location.reload());
    card.appendChild(button);

    const details = document.createElement('details');
    details.style.cssText = 'margin-top: 20px; font-size: 12px; color: #6b7280;';
    const summary = document.createElement('summary');
    summary.style.cssText = 'cursor: pointer;';
    summary.textContent = 'Technical Details';
    details.appendChild(summary);
    const pre = document.createElement('pre');
    pre.style.cssText = 'margin-top: 10px; padding: 10px; background: #f3f4f6; border-radius: 6px; overflow: auto;';
    // Safely set error message using textContent to prevent XSS
    pre.textContent = error instanceof Error ? error.message : String(error);
    details.appendChild(pre);
    card.appendChild(details);

    wrapper.appendChild(card);
    rootElement.appendChild(wrapper);
  }
}
