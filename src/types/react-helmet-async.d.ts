declare module 'react-helmet-async' {
  import type { ComponentType, ReactNode } from 'react';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Helmet: ComponentType<any>;
  export const HelmetProvider: ComponentType<{ children: ReactNode }>;
}
