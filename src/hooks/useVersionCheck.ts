import { logger } from '@/lib/logger';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { safeFetch } from '@/utils/safeFetch';
import { STORAGE_KEYS } from '@/constants/storageKeys';

const CHECK_INTERVAL = 10 * 60 * 1000; // Check every 10 minutes
const VERSION_KEY = STORAGE_KEYS.APP_VERSION;
const LAST_CHECK_KEY = STORAGE_KEYS.APP_VERSION_LAST_CHECK;

// @ts-expect-error - Injected at build time by Vite
const _BUILD_TIME: string = __BUILD_TIME__;

async function clearAllCaches() {
  try {
    logger.debug('[VersionCheck] Clearing all caches...');
    
    // Clear service worker registrations
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // Clear storage but preserve essential data
    const essentialKeys = ['app_theme', 'app_production_logs', 'supabase.auth.token'];
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !essentialKeys.includes(key) && !key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    logger.debug('[VersionCheck] Caches cleared successfully');
  } catch (error) {
    logger.error('[VersionCheck] Error clearing caches:', error);
  }
}

async function checkVersion(): Promise<boolean> {
  try {
    // Prevent too frequent checks
    const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
    const now = Date.now();
    if (lastCheck && now - parseInt(lastCheck) < 60000) {
      return false; // Checked less than 1 minute ago
    }
    
    localStorage.setItem(LAST_CHECK_KEY, now.toString());
    
    // Fetch version.json with cache-busting
    const response = await safeFetch(`/version.json?t=${now}`, {
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (!response.ok) {
      logger.warn('[VersionCheck] Failed to fetch version.json');
      return false;
    }
    
    const data = await response.json();
    const serverVersion = data.buildTime;
    const currentVersion = localStorage.getItem(VERSION_KEY);
    
    // First time - just store version
    if (!currentVersion) {
      localStorage.setItem(VERSION_KEY, serverVersion);
      logger.debug('[VersionCheck] Version initialized:', serverVersion);
      return false;
    }
    
    // Version changed - update needed
    if (currentVersion !== serverVersion) {
      logger.debug('[VersionCheck] Version mismatch detected:', {
        current: currentVersion,
        server: serverVersion
      });
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('[VersionCheck] Error checking version:', error);
    return false;
  }
}

export function useVersionCheck() {
  const checkIntervalRef = useRef<NodeJS.Timeout>();
  const hasShownUpdateToast = useRef(false);

  useEffect(() => {
    // Initial check on mount
    const performCheck = async () => {
      const needsUpdate = await checkVersion();
      
      if (needsUpdate && !hasShownUpdateToast.current) {
        hasShownUpdateToast.current = true;
        
        toast.info('New version available', {
          description: 'A new version is available. The page will reload to apply updates.',
          duration: 5000,
          action: {
            label: 'Reload Now',
            onClick: async () => {
              await clearAllCaches();
              window.location.reload();
            }
          }
        });
        
        // Auto-reload after 10 seconds if user doesn't click
        setTimeout(async () => {
          await clearAllCaches();
          window.location.reload();
        }, 10000);
      }
    };

    // Check immediately
    performCheck();

    // Set up periodic checks
    checkIntervalRef.current = setInterval(performCheck, CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);
}
