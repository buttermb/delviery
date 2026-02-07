// @ts-nocheck
import { logger } from '@/lib/logger';
/**
 * Hook to easily add button monitoring to existing buttons
 */

import { useCallback, useState } from 'react';
import { useButtonMonitor } from '@/lib/utils/buttonMonitor';

interface UseMonitoredButtonOptions {
  component: string;
  action: string;
  buttonId?: string;
  timeout?: number;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useMonitoredButton<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options: UseMonitoredButtonOptions
) {
  const { component, action, buttonId, timeout = 30000, onError, onSuccess } = options;
  const [isLoading, setIsLoading] = useState(false);
  const { trackClick } = useButtonMonitor(component, action, buttonId);

  const monitoredHandler = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      if (isLoading) {
        throw new Error('Button action already in progress');
      }

      setIsLoading(true);
      const startTime = Date.now();
      const complete = trackClick();
      let timeoutId: NodeJS.Timeout | null = null;

      try {
        // Set timeout
        if (timeout > 0) {
          timeoutId = setTimeout(() => {
            complete('timeout', new Error(`Button action timed out after ${timeout}ms`));
            setIsLoading(false);
            logger.warn(
              `Button timeout: ${component}.${action}`,
              { timeout, buttonId, component: 'useMonitoredButton' }
            );
            throw new Error(`Action timed out after ${timeout}ms`);
          }, timeout);
        }

        const result = await handler(...args);

        if (timeoutId) clearTimeout(timeoutId);
        complete('success');
        setIsLoading(false);

        if (onSuccess) {
          onSuccess();
        }

        return result;
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        const errorObj = error instanceof Error ? error : new Error(String(error));
        complete('error', errorObj);
        setIsLoading(false);

        logger.error(
          `Button error: ${component}.${action}`,
          errorObj,
          { component: 'useMonitoredButton', buttonId }
        );

        if (onError) {
          onError(errorObj);
        }

        throw error;
      }
    },
    [handler, isLoading, component, action, buttonId, timeout, trackClick, onError, onSuccess]
  );

  return {
    handler: monitoredHandler,
    isLoading,
  };
}

