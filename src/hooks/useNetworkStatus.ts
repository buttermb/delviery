/**
 * Network Status Hook
 * Monitors online/offline status and provides retry capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface UseNetworkStatusReturn {
  isOnline: boolean;
  isSlowConnection: boolean;
  retryWhenOnline: (fn: () => Promise<void>) => void;
}

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [pendingRetries, setPendingRetries] = useState<Array<() => Promise<void>>>([]);

  // Check connection speed
  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const checkSpeed = () => {
        const effectiveType = connection.effectiveType;
        setIsSlowConnection(effectiveType === 'slow-2g' || effectiveType === '2g');
      };
      
      checkSpeed();
      connection.addEventListener('change', checkSpeed);
      
      return () => connection.removeEventListener('change', checkSpeed);
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      logger.info('Network connection restored');
      
      toast.success('Back Online', {
        description: 'Your connection has been restored.',
      });

      // Execute pending retries
      if (pendingRetries.length > 0) {
        logger.info(`Retrying ${pendingRetries.length} pending operations`);
        
        for (const retry of pendingRetries) {
          try {
            await retry();
          } catch (error) {
            logger.error('Retry failed after reconnection', error);
          }
        }
        
        setPendingRetries([]);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.warn('Network connection lost');
      
      toast.error('Connection Lost', {
        description: 'Please check your internet connection.',
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingRetries]);

  // Add operation to retry queue when online
  const retryWhenOnline = useCallback((fn: () => Promise<void>) => {
    if (isOnline) {
      // Execute immediately if already online
      fn().catch(error => {
        logger.error('Immediate retry failed', error);
      });
    } else {
      // Queue for later
      setPendingRetries(prev => [...prev, fn]);
      toast.info('Operation Queued', {
        description: 'Will retry when connection is restored.',
      });
    }
  }, [isOnline]);

  return {
    isOnline,
    isSlowConnection,
    retryWhenOnline,
  };
}
