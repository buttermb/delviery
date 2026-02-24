import { logger } from '@/lib/logger';
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateDeviceFingerprint } from "@/utils/deviceFingerprint";
import { showErrorToast } from "@/utils/toastHelpers";

import { handleError } from '@/utils/errorHandling/handlers';

export function useDeviceTracking() {
  useEffect(() => {
    const trackDevice = async () => {
      try {
        // Check if online first to avoid unnecessary calls
        if (!navigator.onLine) {
          return;
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // Don't log out on network errors
        if (authError && authError.message?.includes('network')) {
          logger.debug('Network error in device tracking, skipping');
          return;
        }

        if (user) {
          const deviceInfo = generateDeviceFingerprint();

          // Call edge function to track access and check blocks
          const { data, error } = await supabase.functions.invoke('track-access', {
            body: {
              userId: user.id,
              fingerprint: deviceInfo.fingerprint,
              deviceType: deviceInfo.deviceType,
              browser: deviceInfo.browser,
              os: deviceInfo.os,
            },
          });

          // Only process block if no network error
          if (error && !error.message?.includes('network')) {
            logger.error('Device tracking error:', error);
            return;
          }

          // Check for error in response body (some edge functions return 200 with error)
          if (data && typeof data === 'object' && 'error' in data && data.error) {
            const errorMessage = typeof data.error === 'string' ? data.error : 'Device tracking failed';
            logger.error('Device tracking returned error in response:', errorMessage);
            return;
          }

          // If blocked, sign out and redirect
          if (data?.blocked) {
            await supabase.auth.signOut();
            window.location.href = '/';
            showErrorToast("Access Restricted", "Your access has been restricted. Please contact support if you believe this is an error.");
          }
        }
      } catch (error) {
        // Don't disrupt user experience on network errors
        if (error instanceof Error && error.message?.includes('network')) return;

        handleError(error, {
          component: 'useDeviceTracking',
          showToast: false,
          context: { action: 'track_device' }
        });
      }
    };

    trackDevice();

    // Track on auth state changes (but not on network changes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Delay to ensure network is stable
        setTimeout(() => trackDevice(), 1000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}