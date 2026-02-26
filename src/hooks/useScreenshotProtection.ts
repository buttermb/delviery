import { logger } from '@/lib/logger';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { initScreenshotDetection, addWatermark, disableRightClick, ScreenshotAttempt } from '@/utils/screenshotDetection';

interface UseScreenshotProtectionOptions {
  menuId: string;
  customerId?: string;
  customerName?: string;
  enabled: boolean;
  watermarkEnabled?: boolean;
  watermarkText?: string;
  disableRightClickEnabled?: boolean;
  showToast?: boolean;
  autoBurnEnabled?: boolean;
  autoBurnAction?: 'log' | 'block' | 'burn';
}

/**
 * Report a security event to the server-side endpoint for velocity tracking and auto-burn
 */
const reportSecurityEvent = async (
  menuId: string,
  eventType: string,
  metadata?: Record<string, unknown>,
  deviceFingerprint?: string
): Promise<void> => {
  try {
    await supabase.functions.invoke('report-security-event', {
      body: {
        menu_id: menuId,
        event_type: eventType,
        metadata,
        device_fingerprint: deviceFingerprint,
      },
    });
  } catch (error) {
    logger.error('Failed to report security event to server:', error);
  }
};

export const useScreenshotProtection = ({
  menuId,
  customerId,
  customerName,
  enabled,
  watermarkEnabled = true,
  watermarkText,
  disableRightClickEnabled = false,
  showToast = true,
  autoBurnEnabled = false,
  autoBurnAction = 'log',
}: UseScreenshotProtectionOptions) => {
  useEffect(() => {
    if (!enabled) return;

    const cleanupFunctions: (() => void)[] = [];

    // Initialize screenshot detection
    const cleanupDetection = initScreenshotDetection(
      menuId,
      customerId,
      customerName,
      async (attempt: ScreenshotAttempt) => {
        // Log to database
        try {
          await supabase.from('menu_screenshot_attempts').insert({
            menu_id: menuId,
            customer_id: customerId,
            customer_name: customerName,
            device_fingerprint: attempt.deviceFingerprint,
            ip_address: null, // Will be populated by backend
            user_agent: navigator.userAgent,
            action_taken: autoBurnEnabled ? autoBurnAction : 'detected',
            attempted_at: attempt.timestamp.toISOString(),
          });

          // Log security event
          await supabase.from('menu_security_events').insert({
            menu_id: menuId,
            event_type: 'screenshot_attempt',
            severity: 'medium',
            details: {
              method: attempt.method,
              customer_id: customerId,
              customer_name: customerName,
              device_fingerprint: attempt.deviceFingerprint,
            },
          });

          // Report to server for velocity tracking and potential auto-burn
          const eventType = attempt.method === 'keyboard'
            ? 'screenshot_detected'
            : attempt.method === 'visibility'
              ? 'visibility_hidden'
              : 'screenshot_detected';

          await reportSecurityEvent(
            menuId,
            eventType,
            {
              method: attempt.method,
              customer_id: customerId,
              auto_burn_enabled: autoBurnEnabled,
              auto_burn_action: autoBurnAction,
            },
            attempt.deviceFingerprint
          );
        } catch (error) {
          logger.error('Failed to log screenshot attempt:', error);
        }

        // Show toast notification
        if (showToast) {
          toast.error('This action has been logged for security purposes.');
        }
      }
    );

    if (cleanupDetection) {
      cleanupFunctions.push(cleanupDetection);
    }

    // Add watermark if enabled
    if (watermarkEnabled && watermarkText) {
      const cleanupWatermark = addWatermark(watermarkText);
      cleanupFunctions.push(cleanupWatermark);
    }

    // Disable right-click if enabled
    if (disableRightClickEnabled) {
      const cleanupRightClick = disableRightClick();
      cleanupFunctions.push(cleanupRightClick);
    }

    // Cleanup all
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [
    enabled,
    menuId,
    customerId,
    customerName,
    watermarkEnabled,
    watermarkText,
    disableRightClickEnabled,
    showToast,
    autoBurnEnabled,
    autoBurnAction,
  ]);
};