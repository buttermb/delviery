import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const VERSION_KEY = 'app_version';

async function clearAllCaches() {
  try {
    // Clear service worker registrations
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    // Clear all caches - prioritize realtime/API caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const priorityCaches = cacheNames.filter(name => 
        name.includes('runtime') || name.includes('api')
      );
      const otherCaches = cacheNames.filter(name => 
        !name.includes('runtime') && !name.includes('api')
      );
      
      // Clear priority caches first
      await Promise.all(priorityCaches.map(name => caches.delete(name)));
      await Promise.all(otherCaches.map(name => caches.delete(name)));
    }
    
    // Clear storage but preserve essential data
    const essentialKeys = ['nym_theme', 'nym_production_logs'];
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !essentialKeys.includes(key)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    
    console.log('[VersionCheck] Cleared caches successfully');
  } catch (error) {
    console.error('[VersionCheck] Error clearing caches:', error);
  }
}

export function useVersionCheck() {
  // Version checking disabled to prevent unwanted refreshes
  useEffect(() => {
    // No-op - version checking disabled
  }, []);
}
