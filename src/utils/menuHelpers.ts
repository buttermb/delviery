/**
 * Browser-compatible cryptographic utilities for disposable menus
 * Uses Web Crypto API instead of Node.js crypto module
 * 
 * @module menuHelpers
 */

/**
 * Generate a cryptographically secure URL token (browser-compatible)
 */
export const generateUrlToken = (): string => {
  // Use browser's crypto.randomUUID() for secure token generation
  return crypto.randomUUID().replace(/-/g, '');
};

/**
 * Generate a 6-digit access code
 */
export const generateAccessCode = (): string => {
  // Use crypto.getRandomValues for secure random number
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 900000 + 100000);
};

/**
 * Hash a token for storage (SHA-256) - browser-compatible
 */
export const hashToken = async (token: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Format menu URL for sharing
 */
export const formatMenuUrl = (token: string, uniqueToken?: string): string => {
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/m/${token}`;
  return uniqueToken ? `${url}?u=${uniqueToken}` : url;
};

/**
 * Validate geofence coordinates
 */
export const isWithinGeofence = (
  userLat: number,
  userLng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number
): boolean => {
  const distance = calculateDistance(userLat, userLng, centerLat, centerLng);
  return distance <= radiusKm;
};

/**
 * Check if current time is within allowed hours
 */
export const isWithinAllowedHours = (
  startHour: number,
  endHour: number
): boolean => {
  const currentHour = new Date().getHours();
  
  if (startHour <= endHour) {
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Handles overnight time ranges (e.g., 22:00 to 06:00)
    return currentHour >= startHour || currentHour < endHour;
  }
};

/**
 * Generate WhatsApp share message for menu access
 */
export const generateWhatsAppMessage = (
  customerName: string,
  menuUrl: string,
  accessCode: string
): string => {
  return encodeURIComponent(
    `Hi ${customerName}! 🔐\n\n` +
    `You've been granted access to our private wholesale catalog.\n\n` +
    `Access URL: ${menuUrl}\n` +
    `Access Code: ${accessCode}\n\n` +
    `⚠️ IMPORTANT:\n` +
    `• Do not share this link or code\n` +
    `• Location verification required\n` +
    `• Link may expire or burn after use\n\n` +
    `Happy shopping!`
  );
};

/**
 * Mask sensitive tokens for display
 */
export const maskToken = (token: string, visibleChars: number = 8): string => {
  if (token.length <= visibleChars) return token;
  return token.slice(0, visibleChars) + '•'.repeat(Math.min(token.length - visibleChars, 20));
};

/**
 * Validate menu security settings
 */
export const validateSecuritySettings = (settings: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (settings.require_geofence) {
    if (!settings.geofence_lat || !settings.geofence_lng) {
      errors.push('Geofence requires valid coordinates');
    }
    if (!settings.geofence_radius || settings.geofence_radius <= 0) {
      errors.push('Geofence requires valid radius');
    }
  }
  
  if (settings.time_restrictions && settings.allowed_hours) {
    const { start, end } = settings.allowed_hours;
    if (start === undefined || end === undefined || start < 0 || start > 23 || end < 0 || end > 23) {
      errors.push('Invalid time restrictions (hours must be 0-23)');
    }
  }
  
  if (settings.require_whitelist && !settings.invite_only) {
    errors.push('Whitelist enforcement requires invite-only mode');
  }
  
  return { valid: errors.length === 0, errors };
};

/**
 * Generate device fingerprint hash
 */
export const generateDeviceFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  let canvasHash = '';
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    canvasHash = canvas.toDataURL();
  }
  
  const fingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screen: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: canvasHash
  };
  
  return btoa(JSON.stringify(fingerprint));
};
