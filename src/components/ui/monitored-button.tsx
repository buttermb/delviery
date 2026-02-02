import { logger } from '@/lib/logger';
/**
 * Monitored Button Component
 * Automatically tracks button clicks, errors, and performance
 */

import React, { useState, useCallback } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useButtonMonitor } from '@/lib/utils/buttonMonitor';

interface MonitoredButtonProps extends Omit<ButtonProps, 'onClick' | 'onError'> {
  component: string;
  action: string;
  onClick?: () => void | Promise<void>;
  buttonId?: string;
  timeout?: number; // Timeout in milliseconds
  onButtonError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function MonitoredButton({
  component,
  action,
  onClick,
  buttonId,
  timeout = 30000, // 30 second default timeout
  onButtonError,
  onSuccess,
  children,
  disabled,
  ...props
}: MonitoredButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { trackClick } = useButtonMonitor(component, action, buttonId);

  const handleClick = useCallback(async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    const complete = trackClick();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      // Set timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          complete('timeout', new Error(`Button action timed out after ${timeout}ms`));
          setIsLoading(false);
          logger.warn(
            `Button timeout: ${component}.${action}`,
            { timeout, buttonId, component: 'MonitoredButton' }
          );
        }, timeout);
      }

      if (onClick) {
        await onClick();
      }

      if (timeoutId) clearTimeout(timeoutId);
      complete('success');
      setIsLoading(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      complete('error', errorObj);
      setIsLoading(false);

      logger.error(
        `Button error: ${component}.${action}`,
        errorObj,
        { component: 'MonitoredButton', buttonId }
      );

      if (onButtonError) {
        onButtonError(errorObj);
      }
      // Error already logged above with logger.error
    }
  }, [onClick, isLoading, disabled, component, action, buttonId, timeout, trackClick, onButtonError, onSuccess]);

  return (
    <Button
      {...props}
      onClick={handleClick}
      disabled={disabled || isLoading}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
