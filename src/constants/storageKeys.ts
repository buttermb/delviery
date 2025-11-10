/**
 * Centralized Storage Keys
 * 
 * CRITICAL: ALWAYS use these constants instead of hardcoded strings
 * This prevents typos and ensures consistency across the codebase
 */

export const STORAGE_KEYS = {
  // Authentication tokens
  SUPER_ADMIN_ACCESS_TOKEN: 'super_admin_access_token',
  TENANT_ADMIN_ACCESS_TOKEN: 'tenant_admin_access_token',
  TENANT_ADMIN_REFRESH_TOKEN: 'tenant_admin_refresh_token',
  CUSTOMER_ACCESS_TOKEN: 'customer_access_token',
  COURIER_ACCESS_TOKEN: 'courier_access_token',
  
  // User data
  SUPER_ADMIN_USER: 'super_admin_user',
  TENANT_ADMIN_USER: 'tenant_admin_user',
  TENANT_DATA: 'tenant_data',
  CUSTOMER_USER: 'customer_user',
  CUSTOMER_TENANT_DATA: 'customer_tenant_data',
  COURIER_PIN_SESSION: 'courier_pin_session',
  
  // User preferences
  THEME: 'theme',
  LANGUAGE: 'language',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  
  // Age verification
  AGE_VERIFIED: 'age_verified',
  AGE_VERIFICATION_DATE: 'age_verification_date',
  
  // Cart
  GUEST_CART: 'guest_cart',
  CART_ITEMS: 'cart_items',
  
  // Product catalog
  PRODUCT_CATALOG_SEARCH: 'product_catalog_search',
  PRODUCT_FILTER: 'product_filter',
  
  // Autocomplete recent selections
  AUTOCOMPLETE_RECENT_BRAND: 'autocomplete_recent_brand',
  AUTOCOMPLETE_RECENT_STRAIN: 'autocomplete_recent_strain',
  
  // Onboarding
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_STEP: 'onboarding_step',
  
  // Tutorials
  TUTORIAL_COMPLETED: 'tutorial_completed_',
  TUTORIAL_STATE: 'tutorial_state',
  
  // Device tracking
  DEVICE_ID: 'device_id',
  DEVICE_FINGERPRINT: 'device_fingerprint',
  
  // Notifications
  NOTIFICATION_PERMISSION: 'notification_permission',
  PUSH_NOTIFICATION_TOKEN: 'push_notification_token',
  
  // Location
  USER_LOCATION: 'user_location',
  DELIVERY_ADDRESS: 'delivery_address',
  
  // Settings
  NOTIFICATION_SETTINGS: 'notification_settings',
  PRIVACY_SETTINGS: 'privacy_settings',
} as const;

/**
 * Type-safe storage key getter
 */
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Safe localStorage wrapper with error handling
 * 
 * CRITICAL: localStorage can fail in incognito/private mode
 * Always wrap in try-catch
 */
export const safeStorage = {
  getItem: (key: StorageKey): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      // localStorage unavailable (incognito mode, storage disabled)
      return null;
    }
  },

  setItem: (key: StorageKey, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      // Storage quota exceeded or unavailable
      return false;
    }
  },

  removeItem: (key: StorageKey): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  },

  clear: (): boolean => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      return false;
    }
  },
};

/**
 * Safe JSON parse with error handling
 * 
 * CRITICAL: Always parse JSON safely
 */
export const safeJsonParse = <T>(json: string | null, defaultValue: T): T => {
  if (!json) return defaultValue;
  
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    // Invalid JSON, return default
    return defaultValue;
  }
};

/**
 * Safe JSON stringify with error handling
 */
export const safeJsonStringify = (value: unknown): string | null => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    // Circular reference or non-serializable value
    return null;
  }
};
