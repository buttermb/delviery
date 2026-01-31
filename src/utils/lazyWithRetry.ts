import { logger } from '@/lib/logger';
import { clearAllCachesAndServiceWorkers, reloadWithCacheBypass } from './serviceWorkerCache';
/**
 * Lazy import wrapper with retry and error handling
 * Provides fallback UI for failed module loads
 */

import React, { ComponentType, lazy, LazyExoticComponent } from 'react';

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Create a lazy component with retry logic and error handling
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: RetryOptions = {}
): LazyExoticComponent<T> {
  const { maxRetries = 3, retryDelay = 1000 } = options;
  let retryCount = 0;

  return lazy(async () => {
    while (retryCount < maxRetries) {
      try {
        const module = await importFn();
        retryCount = 0; // Reset on success
        return module;
      } catch (error) {
        retryCount++;
        const isModuleError = 
          error instanceof Error && (
            error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('chunk') ||
            error.message.includes('Loading') ||
            error.message.includes('NetworkError')
          );

        if (isModuleError && retryCount < maxRetries) {
          logger.warn(`Module load failed, retrying (${retryCount}/${maxRetries})`, error, {
            component: 'lazyWithRetry',
            retryCount,
            maxRetries,
          });

          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, retryCount - 1)));
          continue;
        }

        // Max retries reached or non-retryable error
        const errorMessage = error instanceof Error ? error.message : String(error);
        let diagnostic: {
          url?: string;
          status?: number;
          statusText?: string;
          redirected?: boolean;
          contentType?: string | null;
          bodySnippet?: string;
          fetchError?: string;
        } | null = null;

        // Best-effort diagnostics: try to fetch the module URL and log status/content-type.
        // This helps distinguish between cache issues vs 404/500/redirect.
        const match = errorMessage.match(/Failed to fetch dynamically imported module:\s*(\S+)/i);
        if (match?.[1]) {
          const url = match[1];
          try {
            const res = await fetch(url, { cache: 'no-store' });
            const contentType = res.headers.get('content-type');
            const text = await res.text();
            diagnostic = {
              url,
              status: res.status,
              statusText: res.statusText,
              redirected: res.redirected,
              contentType,
              bodySnippet: text.slice(0, 400),
            };
          } catch (fetchError) {
            diagnostic = {
              url,
              fetchError: fetchError instanceof Error ? fetchError.message : String(fetchError),
            };
          }
        }

        logger.error('Module load failed after retries', error, {
          component: 'lazyWithRetry',
          retryCount,
          maxRetries,
          diagnostic,
        });

        // Return fallback component using React.createElement to avoid JSX parsing issues
        return {
          default: (() => {
            const FallbackComponent = React.forwardRef<HTMLDivElement>((_, ref) => {
              const handleReload = async () => {
                // Clear all caches and service workers, then reload
                await clearAllCachesAndServiceWorkers();
                reloadWithCacheBypass();
              };

              return React.createElement('div', {
                ref,
                className: 'min-h-screen flex items-center justify-center p-4 bg-muted/20'
              },
                React.createElement('div', {
                  className: 'max-w-md w-full p-6 bg-background border rounded-lg shadow-lg'
                },
                  React.createElement('h2', {
                    className: 'text-lg font-semibold mb-2 text-destructive'
                  }, 'Failed to Load Module'),
                  React.createElement('p', {
                    className: 'text-sm text-muted-foreground mb-4'
                  }, 'The page failed to load. This is usually caused by cached files being outdated.'),
                  React.createElement('button', {
                    onClick: handleReload,
                    className: 'w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
                  }, 'Clear Cache & Reload')
                )
              );
            });
            FallbackComponent.displayName = 'ModuleLoadErrorFallback';
            return FallbackComponent;
          })() as unknown as T,
        };
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new Error('Module load failed');
  });
}

