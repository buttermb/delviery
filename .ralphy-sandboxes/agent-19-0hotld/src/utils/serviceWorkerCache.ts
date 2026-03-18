import { logger } from '@/lib/logger';
/**
 * Service Worker Cache Clearing Utility
 * Provides functions to clear service worker caches and unregister service workers
 * Used for error recovery when module loading fails
 */


/**
 * Unregister all service workers
 */
async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    logger.debug('Service workers not supported', { component: 'serviceWorkerCache' });
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      const unregistered = await registration.unregister();
      logger.info('Service worker unregistered', { 
        scope: registration.scope,
        unregistered,
        component: 'serviceWorkerCache'
      });
    }
    
    logger.info('All service workers unregistered', { 
      count: registrations.length,
      component: 'serviceWorkerCache'
    });
  } catch (error) {
    logger.error('Error unregistering service workers', error, { component: 'serviceWorkerCache' });
    throw error;
  }
}

/**
 * Clear all caches (CacheStorage API)
 */
export async function clearAllCaches(): Promise<void> {
  if (!('caches' in window)) {
    logger.debug('CacheStorage API not supported', { component: 'serviceWorkerCache' });
    return;
  }

  try {
    const cacheNames = await caches.keys();
    
    await Promise.all(
      cacheNames.map(cacheName => {
        logger.debug('Deleting cache', { cacheName, component: 'serviceWorkerCache' });
        return caches.delete(cacheName);
      })
    );
    
    logger.info('All caches cleared', { 
      count: cacheNames.length,
      cacheNames,
      component: 'serviceWorkerCache'
    });
  } catch (error) {
    logger.error('Error clearing caches', error, { component: 'serviceWorkerCache' });
    throw error;
  }
}

/**
 * Clear localStorage cache-related items
 */
function clearLocalStorageCache(): void {
  try {
    const keysToRemove = [
      'js-cache-count',
      'chunk-reload-count',
      'module-cache-version',
      'vite-cache-version',
    ];
    
    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        logger.debug('Removed localStorage cache key', { key, component: 'serviceWorkerCache' });
      }
    });
    
    logger.info('LocalStorage cache cleared', { component: 'serviceWorkerCache' });
  } catch (error) {
    logger.error('Error clearing localStorage cache', error, { component: 'serviceWorkerCache' });
  }
}

/**
 * Clear sessionStorage cache-related items
 */
function clearSessionStorageCache(): void {
  try {
    const keysToRemove = [
      'js-cache-count',
      'chunk-reload-count',
      'module-cache-version',
    ];
    
    keysToRemove.forEach(key => {
      if (sessionStorage.getItem(key)) {
        sessionStorage.removeItem(key);
        logger.debug('Removed sessionStorage cache key', { key, component: 'serviceWorkerCache' });
      }
    });
    
    logger.info('SessionStorage cache cleared', { component: 'serviceWorkerCache' });
  } catch (error) {
    logger.error('Error clearing sessionStorage cache', error, { component: 'serviceWorkerCache' });
  }
}

/**
 * Clear all caches and unregister service workers
 * Complete cache clearing for module loading error recovery
 */
export async function clearAllCachesAndServiceWorkers(): Promise<void> {
  try {
    logger.info('Starting complete cache clear', { component: 'serviceWorkerCache' });
    
    // Clear all caches
    await clearAllCaches();
    
    // Unregister service workers
    await unregisterServiceWorkers();
    
    // Clear localStorage cache items
    clearLocalStorageCache();
    
    // Clear sessionStorage cache items
    clearSessionStorageCache();
    
    logger.info('Complete cache clear finished', { component: 'serviceWorkerCache' });
  } catch (error) {
    logger.error('Error during complete cache clear', error, { component: 'serviceWorkerCache' });
    throw error;
  }
}

/**
 * Reload page with cache bypass
 */
export function reloadWithCacheBypass(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('nocache', Date.now().toString());
  url.searchParams.set('sw-clear', 'true');
  
  logger.info('Reloading with cache bypass', { url: url.toString(), component: 'serviceWorkerCache' });
  
  window.location.href = url.toString();
}

