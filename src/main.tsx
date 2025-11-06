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

// Clear service worker cache if createContext error occurs (stale cache issue)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length > 0) {
      console.log('[APP] Clearing stale service workers...');
      registrations.forEach(reg => reg.unregister());
    }
  });
}

// Register service worker after app loads (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    setTimeout(async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js?v=11');
        console.log('[APP] ServiceWorker registered:', registration.scope);
        
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (error) {
        console.error('[APP] ServiceWorker registration failed:', error);
      }
    }, 5000);
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
  
  console.log('[APP] React ready, removing loader...');
  
  // Create and mount React app first
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  
  // Remove loader after React mounts successfully
  setTimeout(() => {
    const initialLoader = document.getElementById('app-loader');
    if (initialLoader) {
      initialLoader.classList.add('fade-out');
      setTimeout(() => initialLoader.remove(), 300);
    }
  }, 100);
  
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
