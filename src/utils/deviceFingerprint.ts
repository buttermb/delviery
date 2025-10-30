/**
 * Device fingerprinting utility
 * Generates a unique fingerprint for the user's device
 */

export interface DeviceInfo {
  fingerprint: string;
  deviceType: string;
  browser: string;
  os: string;
  screenResolution: string;
  timezone: string;
  language: string;
}

export function generateDeviceFingerprint(): DeviceInfo {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let canvasFingerprint = 'unknown';
  
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Bud Dash', 2, 2);
    canvasFingerprint = canvas.toDataURL().slice(-50);
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    canvasFingerprint,
    navigator.hardwareConcurrency || 'unknown',
  ];

  const fingerprint = hashString(components.join('|'));

  // Detect device type
  const ua = navigator.userAgent.toLowerCase();
  let deviceType = 'desktop';
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect browser
  let browser = 'unknown';
  if (ua.indexOf('firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('safari') > -1) browser = 'Safari';
  else if (ua.indexOf('edge') > -1) browser = 'Edge';

  // Detect OS
  let os = 'unknown';
  if (ua.indexOf('win') > -1) os = 'Windows';
  else if (ua.indexOf('mac') > -1) os = 'MacOS';
  else if (ua.indexOf('linux') > -1) os = 'Linux';
  else if (ua.indexOf('android') > -1) os = 'Android';
  else if (ua.indexOf('ios') > -1 || ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) os = 'iOS';

  return {
    fingerprint,
    deviceType,
    browser,
    os,
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Get device fingerprint for fraud prevention
export async function getDeviceFingerprint(): Promise<string> {
  const deviceInfo = generateDeviceFingerprint();
  return deviceInfo.fingerprint;
}

// Get referral code from URL
export function getReferralCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
}

export async function recordDeviceFingerprint(userId: string, supabase: any) {
  try {
    const deviceInfo = generateDeviceFingerprint();

    // Check if this device is already recorded
    const { data: existing } = await supabase
      .from('device_fingerprints')
      .select('id')
      .eq('user_id', userId)
      .eq('fingerprint', deviceInfo.fingerprint)
      .single();

    if (existing) {
      // Update last seen
      await supabase
        .from('device_fingerprints')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      // Insert new device
      await supabase
        .from('device_fingerprints')
        .insert({
          user_id: userId,
          fingerprint: deviceInfo.fingerprint,
          device_type: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
        });

      // Check if multiple accounts on this device
      const { data: devices } = await supabase
        .from('device_fingerprints')
        .select('user_id')
        .eq('fingerprint', deviceInfo.fingerprint);

      if (devices && devices.length > 1) {
        // Mark all as multiple accounts
        await supabase
          .from('device_fingerprints')
          .update({ multiple_accounts: true })
          .eq('fingerprint', deviceInfo.fingerprint);
      }
    }
  } catch (error) {
    console.error('Error recording device fingerprint:', error);
  }
}