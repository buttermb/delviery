/**
 * Delivery Platform - Main Entry Point
 * 
 * Framework: React 18 + TypeScript + Vite 5.0
 * State: TanStack Query | Styling: Tailwind CSS
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { PerformanceMonitor } from "./utils/performance";
import { initializeSecurityObfuscation } from "./utils/securityObfuscation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import bugFinder from "./utils/bugFinder";
import { logger } from "@/utils/logger";
import { setupGlobalErrorHandlers } from "./lib/globalErrorHandler";

// Setup global error handlers
setupGlobalErrorHandlers();

// Chunk loading error recovery with retry limit
let chunkReloadCount = 0;
const MAX_CHUNK_RELOADS = 3;

window.addEventListener('error', (event) => {
  const errorMessage = event.message || '';
  const isChunkError = errorMessage.includes('chunk') || 
                      errorMessage.includes('Loading') ||
                      errorMessage.includes('createContext') ||
                      errorMessage.includes('Failed to fetch') ||
                      (event.filename && event.filename.includes('chunk'));
  
  if (isChunkError && chunkReloadCount < MAX_CHUNK_RELOADS) {
    chunkReloadCount++;
    const timestamp = new Date().toISOString();
    logger.error('Chunk loading failed', new Error(errorMessage), 'main');
    
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.id = 'chunk-loading-error';
    errorDiv.innerHTML = '⚠️ Loading error detected. Reloading page...';
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
    logger.error('Chunk loading failed after max reload attempts', new Error(errorMessage), 'main');
    
    const errorDiv = document.createElement('div');
    errorDiv.id = 'chunk-loading-error-permanent';
    errorDiv.innerHTML = `
      <div style="max-width:600px;margin:2rem auto;padding:2rem;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:system-ui,sans-serif;">
        <h2 style="color:#dc2626;margin:0 0 1rem 0;">⚠️ Loading Error</h2>
        <p style="color:#374151;margin:0 0 1.5rem 0;line-height:1.6;">
          The application failed to load after multiple attempts. Please try:
        </p>
        <ul style="color:#374151;margin:0 0 1.5rem 0;padding-left:1.5rem;line-height:1.8;">
          <li>Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)</li>
          <li>Clear browser cache and reload</li>
          <li>Try an incognito/private window</li>
        </ul>
        <button onclick="location.reload(true)" style="width:100%;padding:12px;background:#10b981;color:white;border:none;border-radius:6px;font-size:16px;font-weight:500;cursor:pointer;">
          Reload Page
        </button>
      </div>
    `;
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;z-index:99999;padding:1rem';
    document.body.appendChild(errorDiv);
  }
});

// Log app initialization
console.log('[APP] Starting app initialization...');

// Debug: Log theme state during initialization
console.log('[APP] Theme state:', {
  localStorage: localStorage.getItem('theme'),
  htmlClasses: document.documentElement.className,
  prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches
});

// Initialize security obfuscation in production
if (import.meta.env.PROD) {
  try {
    initializeSecurityObfuscation();
  } catch (error) {
    console.error('[APP] Security obfuscation failed:', error);
  }
}

// Register service worker (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js?v=10');
      console.log('[APP] ServiceWorker registered:', registration.scope);
      
      // Only activate new service workers, don't force reload
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.error('[APP] ServiceWorker registration failed:', error);
    }
  });
}

// Initialize performance monitoring
if (import.meta.env.DEV) {
  try {
    PerformanceMonitor.init();
    
    // Log performance report after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        console.log('[APP] Performance Report:', PerformanceMonitor.getReport());
      }, 3000);
    });
  } catch (error) {
    console.error('[APP] Performance monitoring failed:', error);
  }
}

// Initialize bug finder (runs in all environments)
try {
  // BugFinder automatically starts monitoring on instantiation
  console.log('[APP] Bug Finder initialized');
  
  // Log bug scan on initialization
  if (import.meta.env.DEV) {
    const scan = bugFinder.scanBugs();
    if (scan.totalBugs > 0) {
      console.warn('[APP] Existing bugs detected:', scan);
    }
  }
} catch (error) {
  console.error('[APP] Bug Finder initialization failed:', error);
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
  logger.error('[APP] Fatal initialization error', error, 'main');
  
  if (import.meta.env.DEV) {
    logger.debug('Initialization error details', error, 'main');
  }
  
  // Display user-friendly error message
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="max-width: 500px; padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px; background: white;">
          <h1 style="color: #dc2626; margin: 0 0 16px 0; font-size: 24px;">⚠️ Failed to Load</h1>
          <p style="color: #374151; margin: 0 0 20px 0; line-height: 1.5;">
            We encountered an error while loading the app. Please try:
          </p>
          <ul style="color: #374151; margin: 0 0 20px 0; line-height: 1.8;">
            <li>Refreshing the page</li>
            <li>Clearing your browser cache</li>
            <li>Using an incognito/private window</li>
          </ul>
          <button 
            onclick="location.reload()" 
            style="width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer;"
          >
            Reload Page
          </button>
          <details style="margin-top: 20px; font-size: 12px; color: #6b7280;">
            <summary style="cursor: pointer;">Technical Details</summary>
            <pre style="margin-top: 10px; padding: 10px; background: #f3f4f6; border-radius: 6px; overflow: auto;">${error instanceof Error ? error.message : String(error)}</pre>
          </details>
        </div>
      </div>
    `;
  }
}
