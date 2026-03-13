declare module 'react-leaflet' {
  import type { ComponentType } from 'react';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MapContainer: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const TileLayer: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Polygon: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const useMapEvents: (handlers: any) => any;
}
