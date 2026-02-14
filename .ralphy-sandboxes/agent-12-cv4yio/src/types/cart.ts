import type { Product } from "./product";

// Shape of a cart_items row when fetched with join select("*, products(*)")
export interface DbCartItem {
  id: string;              // uuid
  user_id: string;         // uuid
  product_id: string;      // uuid
  quantity: number;
  selected_weight?: string | null; // e.g., "unit", "1/8", etc.
  products?: Product | null;       // from the join (may be null if not joined)
}

// The guest cart entry stored locally (e.g., in localStorage)
export interface GuestCartItem {
  product_id: string;
  quantity: number;
  selected_weight?: string | null;
}

// Guest cart entry combined with product data for rendering
export interface GuestCartItemWithProduct extends GuestCartItem {
  id: string;         // synthetic id (e.g., `${product_id}-${selected_weight ?? "unit"}`)
  products: Product;  // guaranteed for render
}

// Unified type the UI can render (db vs guest)
export type RenderCartItem = DbCartItem | GuestCartItemWithProduct;
