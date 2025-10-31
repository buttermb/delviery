import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
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
}

export const useScreenshotProtection = ({
  menuId,
  customerId,
  customerName,
  enabled,
  watermarkEnabled = true,
  watermarkText,
  disableRightClickEnabled = false,
  showToast = true,
}: UseScreenshotProtectionOptions) => {
  const { toast } = useToast();

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
            action_taken: 'detected',
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
        } catch (error) {
          console.error('Failed to log screenshot attempt:', error);
        }

        // Show toast notification
        if (showToast) {
          toast({
            title: '⚠️ Screenshot Detected',
            description: 'This action has been logged for security purposes.',
            variant: 'destructive',
          });
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
    toast,
  ]);
};