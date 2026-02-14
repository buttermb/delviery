import type { Numeric } from "./money";

export interface Product {
  id: string;
  name: string;
  image_url?: string | null;
  // Base per-unit price (if no weight-specific price exists)
  price?: Numeric | null;
  // Map of weight/size key to price (e.g., "1g", "1/8", "unit")
  prices?: Record<string, Numeric> | null;
  description?: string | null;
  category?: string | null;
  in_stock?: boolean | null;
  [key: string]: unknown;
}
