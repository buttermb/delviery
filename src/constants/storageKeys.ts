/**
 * Centralized localStorage keys to prevent mismatches
 */
export const STORAGE_KEYS = {
  // Super Admin Auth
  SUPER_ADMIN_TOKEN: 'super_admin_token',
  SUPER_ADMIN_USER: 'super_admin_user',
  
  // Tenant Admin Auth
  TENANT_ADMIN_ACCESS_TOKEN: 'tenant_admin_access_token',
  TENANT_ADMIN_REFRESH_TOKEN: 'tenant_admin_refresh_token',
  TENANT_ADMIN_USER: 'tenant_admin_user',
  TENANT_DATA: 'tenant_data',
  
  // Customer Auth
  CUSTOMER_TOKEN: 'customer_token',
  CUSTOMER_USER: 'customer_user',
  CUSTOMER_TENANT_DATA: 'customer_tenant_data',
  
  // Courier Auth
  COURIER_PIN_SESSION: 'courier_pin_session',
  COURIER_ID: 'courier_id',
  
  // UI/UX Preferences
  AGE_VERIFIED: 'age_verified',
  THEME_PREFERENCE: 'theme_preference',
  NOTIFICATION_BANNER_DISMISSED: 'notification_banner_dismissed',
  PWA_INSTALL_DISMISSED: 'pwa-install-dismissed',
  PWA_INSTALL_DISMISSED_TIME: 'pwa-install-dismissed-time',
} as const;
