// Geofencing utilities for location-based access control

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceRule {
  center: Coordinates;
  radius_km: number;
  allowed: boolean;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) * Math.cos(toRad(coord2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Check if coordinates are within a geofence
 */
export const isWithinGeofence = (
  userLocation: Coordinates,
  geofence: GeofenceRule
): boolean => {
  const distance = calculateDistance(userLocation, geofence.center);
  return distance <= geofence.radius_km;
};

/**
 * Validate access based on geofencing rules
 */
export const validateGeofenceAccess = (
  userLocation: Coordinates,
  geofences: GeofenceRule[]
): { allowed: boolean; reason?: string; nearest_distance?: number } => {
  if (!geofences || geofences.length === 0) {
    return { allowed: true };
  }

  let nearestDistance = Infinity;
  
  for (const fence of geofences) {
    const distance = calculateDistance(userLocation, fence.center);
    nearestDistance = Math.min(nearestDistance, distance);
    
    const isWithin = distance <= fence.radius_km;
    
    if (fence.allowed && isWithin) {
      return { allowed: true };
    }
    
    if (!fence.allowed && isWithin) {
      return {
        allowed: false,
        reason: 'Access denied: Location is in restricted zone',
        nearest_distance: distance
      };
    }
  }
  
  // If we have allowed zones but user is not in any
  const hasAllowedZones = geofences.some(f => f.allowed);
  if (hasAllowedZones) {
    return {
      allowed: false,
      reason: 'Access denied: Outside authorized zones',
      nearest_distance: nearestDistance
    };
  }
  
  return { allowed: true };
};

/**
 * Get user's current location
 */
export const getUserLocation = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

/**
 * NYC Borough boundaries (approximate centers and typical radii)
 */
export const NYC_BOROUGHS = {
  manhattan: { latitude: 40.7831, longitude: -73.9712, radius: 10 },
  brooklyn: { latitude: 40.6782, longitude: -73.9442, radius: 15 },
  queens: { latitude: 40.7282, longitude: -73.7949, radius: 20 },
  bronx: { latitude: 40.8448, longitude: -73.8648, radius: 15 },
  staten_island: { latitude: 40.5795, longitude: -74.1502, radius: 12 }
};
