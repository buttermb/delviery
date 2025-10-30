/**
 * Production Health Check
 * Validates critical systems on app load in production
 */

import { supabase } from '@/integrations/supabase/client';
import { productionLogger } from './productionLogger';
import { formatStatus, safeStatus } from './stringHelpers';

export interface HealthCheckResult {
  supabase: boolean;
  serviceWorker: boolean;
  cache: boolean;
  realtime: boolean;
  stringHelpers: boolean;
  issues: string[];
}

export const runProductionHealthCheck = async (): Promise<HealthCheckResult> => {
  const result: HealthCheckResult = {
    supabase: false,
    serviceWorker: false,
    cache: false,
    realtime: false,
    stringHelpers: false,
    issues: [],
  };

  // Check Supabase connection
  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    result.supabase = !error;
    if (error) {
      result.issues.push('Supabase connection failed');
      productionLogger.error('Supabase health check failed', { error });
    }
  } catch (error) {
    result.issues.push('Supabase connection error');
    productionLogger.error('Supabase health check error', { error });
  }

  // Check Service Worker
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      result.serviceWorker = !!registration;
      if (!registration) {
        result.issues.push('Service Worker not registered');
      }
    } else {
      result.serviceWorker = true; // OK if not supported
    }
  } catch (error) {
    result.issues.push('Service Worker check failed');
    productionLogger.error('Service Worker health check error', { error });
  }

  // Check Cache API
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      result.cache = cacheNames.length > 0;
      
      // Validate cache integrity
      for (const cacheName of cacheNames) {
        try {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          // Check if cache is corrupted (empty when it shouldn't be)
          if (keys.length === 0 && cacheName.includes('runtime')) {
            result.issues.push(`Cache ${cacheName} is empty`);
            productionLogger.warning('Empty cache detected', { cacheName });
          }
        } catch (error) {
          result.issues.push(`Cache ${cacheName} is corrupted`);
          productionLogger.error('Cache integrity check failed', { cacheName, error });
        }
      }
    } else {
      result.cache = true; // OK if not supported
    }
  } catch (error) {
    result.issues.push('Cache check failed');
    productionLogger.error('Cache health check error', { error });
  }

  // Check Realtime capability
  try {
    const channel = supabase.channel('health-check');
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Realtime connection timeout'));
      }, 5000);

      channel
        .on('system', {}, () => {})
        .subscribe((status) => {
          clearTimeout(timeout);
          if (status === 'SUBSCRIBED') {
            result.realtime = true;
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            result.issues.push('Realtime connection failed');
            reject(new Error(`Realtime status: ${status}`));
          }
        });
    });

    await supabase.removeChannel(channel);
  } catch (error) {
    result.issues.push('Realtime connection unavailable');
    productionLogger.error('Realtime health check error', { error });
  }

  // Check String Helpers
  try {
    // Test formatStatus with various inputs
    const testCases = [
      { input: 'pending', expected: 'pending' },
      { input: null, expected: 'pending' },
      { input: undefined, expected: 'pending' },
      { input: '', expected: 'pending' },
      { input: 'in_transit', expected: 'in transit' },
    ];

    let allTestsPassed = true;
    for (const test of testCases) {
      try {
        const output = formatStatus(test.input as any);
        if (!output || typeof output !== 'string') {
          allTestsPassed = false;
          result.issues.push(`formatStatus failed for input: ${test.input}`);
          productionLogger.error('formatStatus test failed', { input: test.input, output });
        }
      } catch (error) {
        allTestsPassed = false;
        result.issues.push(`formatStatus threw error for input: ${test.input}`);
        productionLogger.error('formatStatus threw error', { input: test.input, error });
      }
    }

    result.stringHelpers = allTestsPassed;
  } catch (error) {
    result.issues.push('String helpers check failed');
    productionLogger.error('String helpers health check error', { error });
  }

  // Log summary
  const allHealthy = result.supabase && result.serviceWorker && result.cache && result.realtime && result.stringHelpers;
  if (!allHealthy) {
    productionLogger.warning('Health check completed with issues', result);
  } else {
    productionLogger.info('Health check passed', result);
  }

  return result;
};

/**
 * Clear corrupted caches and force fresh data
 */
export const clearCorruptedCaches = async (): Promise<void> => {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        if (cacheName.includes('runtime') || cacheName.includes('api')) {
          await caches.delete(cacheName);
          productionLogger.info('Cleared cache', { cacheName });
        }
      }
    }
  } catch (error) {
    productionLogger.error('Failed to clear caches', { error });
  }
};
