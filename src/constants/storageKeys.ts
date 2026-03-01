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
  SUPER_ADMIN_TENANT_ID: 'super_admin_tenant_id',
  TENANT_ADMIN_USER: 'tenant_admin_user',
  TENANT_DATA: 'tenant_data',
  CUSTOMER_USER: 'customer_user',
  CUSTOMER_TENANT_DATA: 'customer_tenant_data',
  COURIER_PIN_SESSION: 'courier_pin_session',
  
  // User preferences
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  COMPACT_MODE: 'compact_mode',
  ANIMATIONS_ENABLED: 'animations_enabled',
  
  // Age verification
  AGE_VERIFIED: 'age_verified',
  AGE_VERIFICATION_DATE: 'age_verification_date',
  
  // Cart
  GUEST_CART: 'guest_cart',
  CART_ITEMS: 'cart_items',
  GUEST_CHECKOUT_DATA: 'guestCheckoutData',
  
  // Product catalog
  PRODUCT_FILTER: 'productFilter',
  
  // Onboarding
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_STEP: 'onboarding_step',
  ONBOARDING_DISMISSED: 'onboarding_dismissed',
  
  // Device tracking
  DEVICE_FINGERPRINT: 'device_fingerprint',

  // Settings
  NOTIFICATION_SETTINGS: 'notification_settings',
  
  // Email verification
  EMAIL_VERIFICATION_BANNER_DISMISSED: 'email_verification_banner_dismissed',
  
  // Customer mode (retail/wholesale)
  CUSTOMER_MODE: 'customer_mode',
  
  // Sidebar Preferences (legacy - now stored in database)
  SIDEBAR_OPERATION_SIZE: 'sidebar_operation_size',
  SIDEBAR_FAVORITES: 'sidebar_favorites',
  SIDEBAR_COLLAPSED_SECTIONS: 'sidebar_collapsed_sections',
  
  // PWA
  PWA_DISMISS_DATE: 'pwa_dismiss_date',
  
  // Command Palette
  COMMAND_PALETTE_RECENT_SEARCHES: 'command_palette_recent_searches',

  // Recently Used Items
  RECENTLY_USED_ITEMS: 'admin_recently_used_items',

  // Dashboard
  DASHBOARD_WIDGETS: 'dashboard_widgets',

  // Navigation
  SCROLL_POSITIONS: 'scroll_positions',

  // Dashboard Tour
  DASHBOARD_TOUR_COMPLETED: 'dashboard_tour_completed',

  // Sync Status
  SYNC_LAST_SYNCED: 'sync_last_synced',

  // Form Persistence prefix
  FORM_PERSISTENCE_PREFIX: 'form_persistence_',

  // Recent wholesale clients
  RECENT_WHOLESALE_CLIENTS: 'wholesale_clients',

  // Tenant slug (last known tenant for login redirects)
  LAST_TENANT_SLUG: 'lastTenantSlug',

  // Current tenant ID (for RLS context)
  CURRENT_TENANT_ID: 'current_tenant_id',

  // PWA install prompt
  PWA_INSTALL_DISMISSED: 'pwa-install-dismissed',
  PWA_INSTALL_DISMISSED_TIME: 'pwa-install-dismissed-time',

  // Home page notification
  NOTIFICATION_DISMISSED: 'notificationDismissed',

  // Product view counts
  PRODUCT_VIEWS: 'product_views',

  // Push notifications
  NOTIFICATIONS_ENABLED: 'notifications_enabled',

  // Sound alerts
  SOUND_ALERTS_ENABLED: 'sound-alerts-enabled',
  SOUND_ALERTS_VOLUME: 'sound-alerts-volume',
  SOUND_ALERTS_TOGGLE: 'floraiq_sound_alerts_enabled',

  // Impersonation
  IMPERSONATING_TENANT: 'impersonating_tenant',
  IMPERSONATION_TIMESTAMP: 'impersonation_timestamp',

  // Admin recent searches (command palette)
  ADMIN_RECENT_SEARCHES: 'admin_recent_searches',

  // Admin notification center read state
  ADMIN_NOTIFICATIONS_READ: 'floraiq_admin_notifications_read',

  // Dashboard alerts
  DASHBOARD_ALERTS_DISMISSED_PREFIX: 'dashboard_alerts_dismissed_',

  // Dashboard layout
  DASHBOARD_LAYOUT: 'dashboard-layout',

  // Customer search
  CUSTOMER_RECENT_SEARCHES: 'recent_searches',

  // Data explorer
  DATA_EXPLORER_RECENT_QUERIES: 'data_explorer_recent_queries',

  // Disposable menus security settings
  DISPOSABLE_MENUS_SECURITY_SETTINGS: 'disposable_menus_security_settings',

  // Menu checkout customer data
  CHECKOUT_CUSTOMER_DATA: 'checkout_customer_data',

  // Runner
  RUNNER_ID: 'runner_id',
  RUNNER_OFFLINE_QUEUE: 'runner_offline_queue',

  // Tooltip guide (key pattern: tenant_{tenantId}_tooltips_dismissed)
  TOOLTIPS_DISMISSED_PREFIX: 'tenant_',
  TOOLTIPS_DISMISSED_SUFFIX: '_tooltips_dismissed',

  // Shop (store-scoped keys use prefix + store ID)
  SHOP_CART_PREFIX: 'shop_cart_',
  SHOP_CUSTOMER_PREFIX: 'shop_customer_',
  SHOP_WISHLIST_PREFIX: 'shop_wishlist_',
  SHOP_RECENTLY_VIEWED_PREFIX: 'shop_recently_viewed_',
  SHOP_RECENT_SEARCHES_PREFIX: 'shop_recent_searches_',
  SHOP_COUPON_PREFIX: 'shop_coupon_',
  SHOP_CHECKOUT_FORM_PREFIX: 'checkout_form_',

  // Age verification (store-scoped)
  AGE_VERIFIED_PREFIX: 'age_verified_',

  // Tenant notifications read state
  NOTIFICATIONS_READ_PREFIX: 'notifications_read_',

  // Platform settings (super admin)
  PLATFORM_SETTINGS: 'platform_settings',

  // Supabase auth token (legacy)
  SUPABASE_AUTH_TOKEN: 'supabase.auth.token',

  // Super admin supabase session
  SUPERADMIN_SUPABASE_SESSION: 'superadmin_supabase_session',

  // User ID
  FLORAIQ_USER_ID: 'floraiq_user_id',

  // Sidebar migration
  SIDEBAR_MIGRATION_COMPLETE: 'sidebar_migration_complete',
  SIDEBAR_PINNED_ITEMS: 'sidebar_pinned_items',

  // Production debug logs
  PRODUCTION_DEBUG_LOGS: 'production_debug_logs',

  // Production logger
  APP_PRODUCTION_LOGS: 'app_production_logs',

  // Error reporting
  ADMIN_ERROR_LOGS: 'admin_error_logs',

  // Browser notifications
  BROWSER_NOTIFICATIONS_ENABLED: 'floraiq_browser_notifications_enabled',

  // Free tier onboarding
  FREE_TIER_ONBOARDING: 'floraiq_free_tier_onboarding',

  // Feature tracking
  USER_FEATURE_PATTERNS: 'user_feature_patterns',

  // Menu order notification settings
  MENU_ORDER_NOTIFICATION_SETTINGS: 'floraiq_menu_order_notification_settings',

  // Recently viewed products
  RECENTLY_VIEWED: 'thca-recently-viewed',

  // Sidebar mode
  SIDEBAR_MODE: 'floraiq_sidebar_mode',

  // Credit nudges
  CREDIT_NUDGES_DISMISSED: 'credit_nudges_dismissed',
  CREDIT_NUDGES_SHOWN_SESSION: 'credit_nudges_shown_session',

  // Version check
  APP_VERSION: 'app_version',
  APP_VERSION_LAST_CHECK: 'app_version_last_check',

  // Feature discovery tips
  DISMISSED_FEATURE_TIPS: 'dismissed_feature_tips',

  // What's new
  WHATS_NEW: 'floraiq_whats_new_r3',

  // Admin sidebar
  ADMIN_SIDEBAR_COLLAPSED: 'admin-sidebar-collapsed',
  ADMIN_SIDEBAR_SECTIONS: 'admin-sidebar-sections',

  // Signup form persistence
  SIGNUP_FORM_DATA: 'signup_form_data',
  SIGNUP_FORM_DATA_EXPIRY: 'signup_form_data_expiry',

  // Credit grace period
  CREDIT_GRACE_PERIOD_START: 'credit_grace_period_start',

  // Active store selection
  ACTIVE_STORE_PREFIX: 'activeStoreId_',

  // Onboarding completed (tenant-scoped)
  ONBOARDING_COMPLETED_PREFIX: 'onboarding_completed_',

  // Live Orders view preference
  LIVE_ORDERS_VIEW: 'live_orders_view',
  // Storefront getting started checklist dismissed (tenant-scoped)
  STOREFRONT_CHECKLIST_DISMISSED_PREFIX: 'storefront_checklist_dismissed_',
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
    } catch {
      // localStorage unavailable (incognito mode, storage disabled)
      return null;
    }
  },

  setItem: (key: StorageKey, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      // Storage quota exceeded or unavailable
      return false;
    }
  },

  removeItem: (key: StorageKey): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear: (): boolean => {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Safe JSON parse with error handling - returns null on error
 *
 * CRITICAL: Always parse JSON safely
 */
export const safeJsonParseOrNull = <T>(json: string | null): T | null => {
  if (!json) return null;

  try {
    return JSON.parse(json) as T;
  } catch {
    // Invalid JSON, return null
    return null;
  }
};

/**
 * Safe JSON parse with error handling - returns defaultValue on error
 *
 * CRITICAL: Always parse JSON safely
 */
export const safeJsonParse = <T>(json: string | null, defaultValue: T): T => {
  if (!json) return defaultValue;

  try {
    return JSON.parse(json) as T;
  } catch {
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
  } catch {
    // Circular reference or non-serializable value
    return null;
  }
};
