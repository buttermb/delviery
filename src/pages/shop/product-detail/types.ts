/**
 * Product Detail — Shared Types
 * Type definitions and data transformation for the product detail page
 */

export interface RpcProduct {
  product_id: string;
  product_name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  sku: string | null;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  images: string[] | null;
  is_featured: boolean;
  is_on_sale: boolean;
  stock_quantity: number;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  sort_order: number;
  created_at: string;
  metrc_retail_id: string | null;
  exclude_from_discounts: boolean;
  minimum_price: number | null;
  effects: string[] | null;
  min_expiry_days: number | null;
}

export interface ProductDetails {
  product_id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  category: string | null;
  price: number;
  display_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  images: string[];
  in_stock: boolean;
  stock_quantity: number;
  is_featured: boolean;
  marketplace_category_name: string | null;
  variants: string[];
  tags: string[];
  brand: string | null;
  sku: string | null;
  strain_type: string | null;
  thc_content: number | null;
  cbd_content: number | null;
  metrc_retail_id: string | null;
  exclude_from_discounts: boolean;
  minimum_price: number | null;
  effects: string[];
  min_expiry_days: number | null;
}

export interface ProductReview {
  id: string;
  customer_name: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

/** Transform RPC response to component interface */
export function transformProduct(rpc: RpcProduct): ProductDetails {
  return {
    product_id: rpc.product_id,
    name: rpc.product_name,
    description: rpc.description,
    short_description: rpc.description?.substring(0, 150) || null,
    category: rpc.category,
    price: rpc.price,
    display_price: rpc.sale_price || rpc.price,
    compare_at_price: rpc.sale_price ? rpc.price : null,
    image_url: rpc.image_url,
    images: rpc.images ?? [],
    in_stock: rpc.stock_quantity > 0,
    stock_quantity: rpc.stock_quantity,
    is_featured: rpc.is_featured,
    marketplace_category_name: rpc.category,
    variants: [],
    tags: [],
    brand: rpc.brand,
    sku: rpc.sku,
    strain_type: rpc.strain_type,
    thc_content: rpc.thc_content,
    cbd_content: rpc.cbd_content,
    metrc_retail_id: rpc.metrc_retail_id,
    exclude_from_discounts: rpc.exclude_from_discounts,
    minimum_price: rpc.minimum_price,
    effects: rpc.effects ?? [],
    min_expiry_days: rpc.min_expiry_days,
  };
}
