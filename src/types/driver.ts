// ---------------------------------------------------------------------------
// Driver domain types — shared across driver management features
// ---------------------------------------------------------------------------

export type DriverStatus = 'pending' | 'active' | 'inactive' | 'suspended' | 'terminated';
export type DriverAvailability = 'online' | 'offline' | 'on_delivery';

/** Core driver record — mirrors the couriers table + migration columns */
export interface Driver {
  id: string;
  user_id: string | null;
  tenant_id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  phone: string;

  // Status
  status: DriverStatus;
  availability: DriverAvailability;
  is_active: boolean;
  is_online: boolean;

  // Vehicle
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  license_number: string;

  // Location
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  last_seen_at: string | null;

  // Zone
  zone_id: string | null;

  // Performance
  commission_rate: number | null;
  rating: number | null;
  total_deliveries: number | null;
  on_time_rate: number | null;

  // Auth
  admin_pin: string | null;
  admin_pin_verified: boolean | null;
  pin_hash: string | null;
  pin_set_at: string | null;
  pin_last_verified_at: string | null;

  // Profile
  profile_photo_url: string | null;
  notes: string | null;

  // Notifications
  notification_sound: boolean | null;
  notification_vibrate: boolean | null;

  // Suspension
  suspended_at: string | null;
  suspended_until: string | null;
  suspend_reason: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/** Delivery zone record */
export interface Zone {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

/** Activity log entry — mirrors driver_activity_log table */
export interface ActivityLogEntry {
  id: string;
  tenant_id: string;
  driver_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

/** Filter state used by DriverDirectoryPage */
export interface DriverFilters {
  status: DriverStatus | 'all';
  availability: DriverAvailability | 'all';
  vehicleType: string;
  ratingMin: number;
  ratingMax: number;
  zones: string[];
  search?: string;
}
