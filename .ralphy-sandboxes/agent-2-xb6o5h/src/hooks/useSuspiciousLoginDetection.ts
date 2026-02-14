import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateDeviceFingerprint } from '@/utils/deviceFingerprint';
import { logger } from '@/lib/logger';

interface SuspiciousLoginResult {
  suspicious: boolean;
  alertType?: string;
  alertId?: string;
  deviceId?: string;
  emailSent?: boolean;
  isNewDevice?: boolean;
}

/**
 * Hook that detects suspicious logins by checking device fingerprint
 * against known devices. Triggers on SIGNED_IN auth events.
 * Sends email notification to user if login is from new device/location.
 */
export function useSuspiciousLoginDetection() {
  const checkLogin = useCallback(async (userId: string) => {
    try {
      if (!navigator.onLine) {
        return;
      }

      const deviceInfo = generateDeviceFingerprint();

      const { data, error } = await supabase.functions.invoke<SuspiciousLoginResult>(
        'detect-suspicious-login',
        {
          body: {
            userId,
            fingerprint: deviceInfo.fingerprint,
            deviceType: deviceInfo.deviceType,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            userAgent: navigator.userAgent,
            screenResolution: deviceInfo.screenResolution,
            timezone: deviceInfo.timezone,
            language: deviceInfo.language,
          },
        }
      );

      if (error) {
        if (!error.message?.includes('network')) {
          logger.error('Suspicious login detection error:', error);
        }
        return;
      }

      if (data?.suspicious) {
        logger.info('Suspicious login detected', {
          alertType: data.alertType,
          alertId: data.alertId,
          emailSent: data.emailSent,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!message.includes('network')) {
        logger.error('Error in suspicious login detection:', error);
      }
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.id) {
          // Small delay to ensure auth is fully established
          setTimeout(() => checkLogin(session.user.id), 1500);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [checkLogin]);
}
