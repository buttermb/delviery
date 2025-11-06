import { useState, useEffect } from 'react';

// Version from Vite build config
const CURRENT_VERSION = BUILD_TIMESTAMP;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const VERSION_KEY = 'app_version';

export interface VersionInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}

export function useVersionCheck() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    hasUpdate: false,
    currentVersion: CURRENT_VERSION,
    latestVersion: CURRENT_VERSION,
  });

  useEffect(() => {
    // Store current version on first load
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (!storedVersion) {
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }

    // Check if current version differs from stored version
    const checkVersion = () => {
      const stored = localStorage.getItem(VERSION_KEY);
      if (stored && stored !== CURRENT_VERSION) {
        console.log('[VersionCheck] New version detected:', {
          stored,
          current: CURRENT_VERSION,
        });
        setVersionInfo({
          hasUpdate: true,
          currentVersion: stored,
          latestVersion: CURRENT_VERSION,
        });
      }
    };

    checkVersion();

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'VERSION_UPDATE') {
          console.log('[VersionCheck] Service worker version update:', event.data.version);
          setVersionInfo({
            hasUpdate: true,
            currentVersion: CURRENT_VERSION,
            latestVersion: event.data.version,
          });
        }
      });

      // Check for updates when service worker activates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[VersionCheck] Service worker controller changed');
        checkVersion();
      });
    }

    // Periodically check for updates
    const intervalId = setInterval(() => {
      checkVersion();
      
      // Also check if service worker has updates waiting
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CHECK_VERSION' });
      }
    }, VERSION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  const updateVersion = () => {
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    window.location.reload();
  };

  const dismissUpdate = () => {
    setVersionInfo((prev) => ({ ...prev, hasUpdate: false }));
  };

  return {
    ...versionInfo,
    updateVersion,
    dismissUpdate,
  };
}
