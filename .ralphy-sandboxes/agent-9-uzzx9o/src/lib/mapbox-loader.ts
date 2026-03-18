/**
 * Lazy loader for Mapbox GL JS library
 * Only loads the library when actually needed for rendering maps
 * This reduces initial bundle size and improves page load performance
 */

import type mapboxgl from 'mapbox-gl';

type MapboxModule = typeof mapboxgl;

let mapboxInstance: MapboxModule | null = null;
let loadingPromise: Promise<MapboxModule> | null = null;

/**
 * Dynamically imports the Mapbox GL library
 * Uses caching to ensure the library is only loaded once
 * @returns Promise that resolves to the Mapbox GL module
 */
export async function loadMapbox(): Promise<MapboxModule> {
  // Return cached instance if already loaded
  if (mapboxInstance) {
    return mapboxInstance;
  }

  // Return existing loading promise if already in progress
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading the library
  loadingPromise = (async () => {
    // Import both the library and CSS in parallel
    const [mapboxModule] = await Promise.all([
      import('mapbox-gl'),
      import('mapbox-gl/dist/mapbox-gl.css'),
    ]);

    mapboxInstance = mapboxModule.default;
    return mapboxInstance;
  })();

  return loadingPromise;
}

/**
 * Check if Mapbox GL has been loaded
 * @returns true if the library is already loaded
 */
export function isMapboxLoaded(): boolean {
  return mapboxInstance !== null;
}

/**
 * Reset the loader state (mainly for testing purposes)
 */
export function resetMapboxLoader(): void {
  mapboxInstance = null;
  loadingPromise = null;
}
